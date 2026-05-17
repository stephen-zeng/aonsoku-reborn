import Foundation
import AVFoundation
import Capacitor
import UIKit

@objc(AonsokuNativeAudioPlugin)
public class AonsokuNativeAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AonsokuNativeAudioPlugin"
    public let jsName = "AonsokuNativeAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "load", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seek", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setRepeatMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setShuffle", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setQueue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "skipToNext", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "skipToPrevious", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateMetadata", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "preload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    private var player: AVPlayer?
    private var playerItem: AVPlayerItem?
    private let audioSession = AVAudioSession.sharedInstance()
    private var statusObservation: NSKeyValueObservation?
    private var durationObservation: NSKeyValueObservation?
    private var timeControlStatusObservation: NSKeyValueObservation?
    private var timeObserverToken: Any?
    private var endObserver: NSObjectProtocol?
    private var failedEndObserver: NSObjectProtocol?
    private var interruptionObserver: NSObjectProtocol?
    private var routeChangeObserver: NSObjectProtocol?
    private var didEnterBackgroundObserver: NSObjectProtocol?
    private var willEnterForegroundObserver: NSObjectProtocol?
    private var didBecomeActiveObserver: NSObjectProtocol?
    private var isAudioSessionConfigured = false
    private var wasPlayingBeforeInterruption = false
    private var repeatMode = "off"
    private var shuffleEnabled = false
    private var queueItemCount = 0
    private var queueIndex = 0
    private var currentSourceKind: String?
    private var currentRadioId: String?

    public override func load() {
        super.load()
        registerLifecycleObservers()

        do {
            try configureAudioSession()
        } catch {
            emitError(code: "audio_session_failed", message: error.localizedDescription)
        }
    }

    deinit {
        removeLifecycleObservers()
        clearPlayer(sendIdleEvent: false, deactivateSession: true)
    }

    @objc func load(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                guard let source = call.getObject("source") else {
                    throw NativeAudioPluginError.invalidSource("Missing audio source.")
                }

                let resolvedSource = try self.resolveSource(from: source)
                let item = AVPlayerItem(url: resolvedSource.url)
                let player = AVPlayer(playerItem: item)
                let startTime = max(0, call.getDouble("startTime") ?? 0)
                let autoplay = call.getBool("autoplay") ?? false

                try self.configureAudioSession()
                self.clearPlayer(sendIdleEvent: false)
                self.player = player
                self.playerItem = item
                self.currentSourceKind = resolvedSource.kind
                self.currentRadioId = resolvedSource.radioId
                self.addObservers(for: item, player: player)
                self.addProgressObserver(to: player)

                self.emitPlaybackState("loading")

                if startTime > 0 {
                    player.seek(to: self.makeTime(startTime))
                }

                if autoplay {
                    try self.activateAudioSession()
                    player.play()
                    self.emitPlaybackState("playing")
                }

                call.resolve()
            } catch {
                self.reject(call, error: error)
            }
        }
    }

    @objc func play(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                guard let player = self.player else {
                    self.reject(call, code: "no_source", message: "No audio source is loaded.")
                    return
                }

                try self.activateAudioSession()
                player.play()
                self.emitPlaybackState("playing")
                call.resolve()
            } catch {
                self.reject(call, error: error)
            }
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.player?.pause()
            self.emitPlaybackState("paused")
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.player?.pause()
            self.player?.seek(to: .zero)
            self.emitPlaybackState("stopped")
            self.emitProgress()
            self.deactivateAudioSession()
            call.resolve()
        }
    }

    @objc func seek(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let player = self.player else {
                self.reject(call, code: "no_source", message: "No audio source is loaded.")
                return
            }

            let position = max(0, call.getDouble("position") ?? 0)
            player.seek(to: self.makeTime(position), toleranceBefore: .zero, toleranceAfter: .zero) { finished in
                self.emitProgress()
                if finished {
                    call.resolve()
                } else {
                    self.reject(call, code: "seek_cancelled", message: "Native seek was cancelled.")
                }
            }
        }
    }

    @objc func setRepeatMode(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let mode = call.getString("mode") ?? "off"
            guard ["off", "one", "all"].contains(mode) else {
                self.reject(call, code: "invalid_repeat_mode", message: "Unsupported repeat mode: \(mode).")
                return
            }

            self.repeatMode = mode
            call.resolve()
        }
    }

    @objc func setShuffle(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.shuffleEnabled = call.getBool("enabled") ?? false
            call.resolve()
        }
    }

    @objc func setQueue(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let items = call.getArray("items") ?? []
            let requestedIndex = call.getInt("index") ?? 0

            guard requestedIndex >= 0 else {
                self.reject(call, code: "invalid_queue", message: "Queue index must be non-negative.")
                return
            }

            if items.isEmpty {
                guard requestedIndex == 0 else {
                    self.reject(call, code: "invalid_queue", message: "Empty native queue must use index 0.")
                    return
                }
                self.queueItemCount = 0
                self.queueIndex = 0
                call.resolve()
                return
            }

            guard requestedIndex < items.count else {
                self.reject(call, code: "invalid_queue", message: "Queue index is outside the native queue.")
                return
            }

            self.queueItemCount = items.count
            self.queueIndex = requestedIndex
            call.resolve()
        }
    }

    @objc func skipToNext(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.notifyListeners("remoteCommand", data: ["command": "next"])
            call.resolve()
        }
    }

    @objc func skipToPrevious(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.notifyListeners("remoteCommand", data: ["command": "previous"])
            call.resolve()
        }
    }

    @objc func updateMetadata(_ call: CAPPluginCall) {
        call.resolve()
    }

    @objc func preload(_ call: CAPPluginCall) {
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.clearPlayer(sendIdleEvent: true, deactivateSession: true)
            self.resetControlState()
            call.resolve()
        }
    }

    private func configureAudioSession() throws {
        guard !isAudioSessionConfigured else {
            return
        }

        try audioSession.setCategory(.playback, mode: .default)
        isAudioSessionConfigured = true
    }

    private func activateAudioSession() throws {
        try configureAudioSession()
        try audioSession.setActive(true)
    }

    private func deactivateAudioSession() {
        try? audioSession.setActive(false, options: [.notifyOthersOnDeactivation])
    }

    private func registerLifecycleObservers() {
        let center = NotificationCenter.default

        if interruptionObserver == nil {
            interruptionObserver = center.addObserver(
                forName: AVAudioSession.interruptionNotification,
                object: audioSession,
                queue: .main
            ) { [weak self] notification in
                self?.handleAudioSessionInterruption(notification)
            }
        }

        if routeChangeObserver == nil {
            routeChangeObserver = center.addObserver(
                forName: AVAudioSession.routeChangeNotification,
                object: audioSession,
                queue: .main
            ) { [weak self] notification in
                self?.handleAudioSessionRouteChange(notification)
            }
        }

        if didEnterBackgroundObserver == nil {
            didEnterBackgroundObserver = center.addObserver(
                forName: UIApplication.didEnterBackgroundNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.handleApplicationVisibilityChanged()
            }
        }

        if willEnterForegroundObserver == nil {
            willEnterForegroundObserver = center.addObserver(
                forName: UIApplication.willEnterForegroundNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.handleApplicationVisibilityChanged()
            }
        }

        if didBecomeActiveObserver == nil {
            didBecomeActiveObserver = center.addObserver(
                forName: UIApplication.didBecomeActiveNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.handleApplicationVisibilityChanged()
            }
        }
    }

    private func removeLifecycleObservers() {
        let center = NotificationCenter.default

        for observer in [
            interruptionObserver,
            routeChangeObserver,
            didEnterBackgroundObserver,
            willEnterForegroundObserver,
            didBecomeActiveObserver,
        ] {
            if let observer {
                center.removeObserver(observer)
            }
        }

        interruptionObserver = nil
        routeChangeObserver = nil
        didEnterBackgroundObserver = nil
        willEnterForegroundObserver = nil
        didBecomeActiveObserver = nil
    }

    private func handleAudioSessionInterruption(_ notification: Notification) {
        guard
            let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: rawType)
        else {
            return
        }

        switch type {
        case .began:
            wasPlayingBeforeInterruption = player?.timeControlStatus == .playing
            player?.pause()
            notifyListeners("interruptionChanged", data: ["type": "began"])
            emitBuffering(false)
            emitPlaybackState("paused")
            emitProgress()
        case .ended:
            let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let options = AVAudioSession.InterruptionOptions(rawValue: rawOptions)
            let shouldResume = options.contains(.shouldResume)

            notifyListeners("interruptionChanged", data: [
                "type": "ended",
                "shouldResume": shouldResume,
            ])

            if shouldResume, wasPlayingBeforeInterruption, let player = player {
                do {
                    try activateAudioSession()
                    player.play()
                    emitPlaybackState("playing")
                } catch {
                    emitError(code: "audio_session_failed", message: error.localizedDescription)
                    emitCurrentPlaybackState()
                }
            } else {
                emitCurrentPlaybackState()
            }

            wasPlayingBeforeInterruption = false
        @unknown default:
            emitError(code: "unknown_interruption", message: "Native audio received an unknown interruption.")
        }
    }

    private func handleAudioSessionRouteChange(_ notification: Notification) {
        let reason = routeChangeReason(from: notification)

        notifyListeners("routeChanged", data: ["reason": reason])
        emitCurrentPlaybackState()
        emitProgress()
    }

    private func handleApplicationVisibilityChanged() {
        emitCurrentPlaybackState()
        emitProgress()
    }

    private func resolveSource(from source: JSObject) throws -> ResolvedAudioSource {
        guard let kind = source["kind"] as? String else {
            throw NativeAudioPluginError.invalidSource("Missing source kind.")
        }

        switch kind {
        case "stream":
            guard let urlString = source["url"] as? String, let url = URL(string: urlString) else {
                throw NativeAudioPluginError.invalidSource("Invalid audio URL.")
            }
            return ResolvedAudioSource(kind: kind, url: url, radioId: nil)
        case "radio":
            guard let urlString = source["url"] as? String, let url = URL(string: urlString) else {
                throw NativeAudioPluginError.invalidSource("Invalid radio stream URL.")
            }
            return ResolvedAudioSource(kind: kind, url: url, radioId: source["radioId"] as? String)
        case "blob":
            throw NativeAudioPluginError.unsupportedSource("Blob URLs are not supported by native iOS playback yet.")
        case "native-file":
            throw NativeAudioPluginError.unsupportedSource("Native cached files are not supported until Phase 4 cached playback work lands.")
        default:
            throw NativeAudioPluginError.unsupportedSource("Unsupported audio source kind: \(kind).")
        }
    }

    private func addObservers(for item: AVPlayerItem, player: AVPlayer) {
        statusObservation = item.observe(\.status, options: [.new]) { [weak self] observedItem, _ in
            DispatchQueue.main.async {
                self?.handleStatusChanged(observedItem)
            }
        }

        durationObservation = item.observe(\.duration, options: [.new]) { [weak self] observedItem, _ in
            DispatchQueue.main.async {
                self?.emitDuration(for: observedItem)
            }
        }

        timeControlStatusObservation = player.observe(\.timeControlStatus, options: [.new]) { [weak self] observedPlayer, _ in
            DispatchQueue.main.async {
                self?.handleTimeControlStatusChanged(observedPlayer.timeControlStatus)
            }
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            self?.handleEnded()
        }

        failedEndObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemFailedToPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] notification in
            let error = notification.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? Error
            self?.emitError(code: "playback_failed", message: error?.localizedDescription ?? "Native playback failed.")
            self?.emitPlaybackState("failed")
        }
    }

    private func addProgressObserver(to player: AVPlayer) {
        let interval = CMTime(seconds: 0.5, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        timeObserverToken = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] _ in
            self?.emitProgress()
        }
    }

    private func handleStatusChanged(_ item: AVPlayerItem) {
        switch item.status {
        case .readyToPlay:
            emitDuration(for: item)
            emitBuffering(false)
        case .failed:
            emitError(
                code: "load_failed",
                message: item.error?.localizedDescription ?? "Native audio failed to load."
            )
            emitPlaybackState("failed")
        case .unknown:
            emitPlaybackState("loading")
        @unknown default:
            emitError(code: "unknown_status", message: "Native audio entered an unknown state.")
        }
    }

    private func handleTimeControlStatusChanged(_ status: AVPlayer.TimeControlStatus) {
        switch status {
        case .playing:
            emitBuffering(false)
            emitPlaybackState("playing")
        case .paused:
            emitBuffering(false)
        case .waitingToPlayAtSpecifiedRate:
            emitBuffering(true)
        @unknown default:
            emitBuffering(false)
        }
    }

    private func handleEnded() {
        emitProgress()
        emitPlaybackState("ended")
        notifyListeners("ended", data: ["reason": "finished"])
    }

    private func clearPlayer(sendIdleEvent: Bool, deactivateSession: Bool = false) {
        if let token = timeObserverToken {
            player?.removeTimeObserver(token)
            timeObserverToken = nil
        }

        if let observer = endObserver {
            NotificationCenter.default.removeObserver(observer)
            endObserver = nil
        }

        if let observer = failedEndObserver {
            NotificationCenter.default.removeObserver(observer)
            failedEndObserver = nil
        }

        statusObservation = nil
        durationObservation = nil
        timeControlStatusObservation = nil

        player?.pause()
        player?.replaceCurrentItem(with: nil)
        player = nil
        playerItem = nil
        currentSourceKind = nil
        currentRadioId = nil

        if sendIdleEvent {
            emitPlaybackState("idle")
            emitBuffering(false)
        }

        if deactivateSession {
            deactivateAudioSession()
        }
    }

    private func resetControlState() {
        repeatMode = "off"
        shuffleEnabled = false
        queueItemCount = 0
        queueIndex = 0
    }

    private func emitPlaybackState(_ state: String) {
        notifyListeners("playbackStateChanged", data: ["state": state])
    }

    private func emitProgress() {
        guard let player = player else {
            notifyListeners("progress", data: ["currentTime": 0, "duration": 0, "bufferedTime": 0])
            return
        }

        let currentTime = seconds(from: player.currentTime())
        let duration = durationSeconds()

        notifyListeners("progress", data: [
            "currentTime": currentTime,
            "duration": duration,
            "bufferedTime": bufferedTime(),
        ])
    }

    private func emitDuration(for item: AVPlayerItem) {
        let duration = seconds(from: item.duration)
        guard duration > 0 else {
            return
        }

        notifyListeners("durationChanged", data: ["duration": duration])
    }

    private func emitBuffering(_ isBuffering: Bool) {
        notifyListeners("bufferingChanged", data: ["isBuffering": isBuffering])
    }

    private func emitCurrentPlaybackState() {
        guard let player = player else {
            emitPlaybackState("idle")
            emitBuffering(false)
            return
        }

        switch player.timeControlStatus {
        case .playing:
            emitBuffering(false)
            emitPlaybackState("playing")
        case .paused:
            emitBuffering(false)
            emitPlaybackState("paused")
        case .waitingToPlayAtSpecifiedRate:
            emitBuffering(true)
            emitPlaybackState("loading")
        @unknown default:
            emitBuffering(false)
        }
    }

    private func emitError(code: String, message: String) {
        notifyListeners("error", data: [
            "code": code,
            "message": message,
        ])
    }

    private func reject(_ call: CAPPluginCall, error: Error) {
        let pluginError = error as? NativeAudioPluginError
        let code = pluginError?.code ?? "native_error"
        let message = pluginError?.errorDescription ?? error.localizedDescription
        emitError(code: code, message: message)
        call.reject(message, code, error)
    }

    private func reject(_ call: CAPPluginCall, code: String, message: String) {
        emitError(code: code, message: message)
        call.reject(message, code)
    }

    private func durationSeconds() -> Double {
        guard let item = playerItem else {
            return 0
        }

        let itemDuration = seconds(from: item.duration)
        if itemDuration > 0 {
            return itemDuration
        }

        return seconds(from: item.asset.duration)
    }

    private func bufferedTime() -> Double {
        guard let range = playerItem?.loadedTimeRanges.first?.timeRangeValue else {
            return seconds(from: player?.currentTime() ?? .zero)
        }

        return seconds(from: range.start) + seconds(from: range.duration)
    }

    private func seconds(from time: CMTime) -> Double {
        let seconds = CMTimeGetSeconds(time)
        guard seconds.isFinite, seconds >= 0 else {
            return 0
        }

        return seconds
    }

    private func makeTime(_ seconds: Double) -> CMTime {
        CMTime(seconds: seconds, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
    }

    private func routeChangeReason(from notification: Notification) -> String {
        guard
            let rawReason = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
            let reason = AVAudioSession.RouteChangeReason(rawValue: rawReason)
        else {
            return "unknown"
        }

        switch reason {
        case .unknown:
            return "unknown"
        case .newDeviceAvailable:
            return "newDeviceAvailable"
        case .oldDeviceUnavailable:
            return "oldDeviceUnavailable"
        case .categoryChange:
            return "categoryChange"
        case .override:
            return "override"
        case .wakeFromSleep:
            return "wakeFromSleep"
        case .noSuitableRouteForCategory:
            return "noSuitableRouteForCategory"
        case .routeConfigurationChange:
            return "routeConfigurationChange"
        @unknown default:
            return "unknown"
        }
    }
}

private struct ResolvedAudioSource {
    let kind: String
    let url: URL
    let radioId: String?
}

private enum NativeAudioPluginError: LocalizedError {
    case invalidSource(String)
    case unsupportedSource(String)

    var code: String {
        switch self {
        case .invalidSource:
            return "invalid_source"
        case .unsupportedSource:
            return "unsupported_source"
        }
    }

    var errorDescription: String? {
        switch self {
        case .invalidSource(let message):
            return message
        case .unsupportedSource(let message):
            return message
        }
    }
}
