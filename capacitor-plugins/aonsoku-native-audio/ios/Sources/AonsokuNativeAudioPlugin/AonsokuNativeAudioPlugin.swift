import Foundation
import AVFoundation
import Capacitor
import MediaPlayer
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
    private var currentMetadata = NativeAudioMetadata()
    private var artworkTask: URLSessionDataTask?
    private var nowPlayingRevision = 0
    private var remoteCommandTargets: [(command: MPRemoteCommand, target: Any)] = []

    public override func load() {
        super.load()
        registerLifecycleObservers()
        registerRemoteCommands()

        do {
            try configureAudioSession()
        } catch {
            emitError(code: "audio_session_failed", message: error.localizedDescription)
        }
    }

    deinit {
        unregisterRemoteCommands()
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
                let metadata = self.metadata(from: call.getObject("metadata"))

                try self.configureAudioSession()
                self.clearPlayer(sendIdleEvent: false)
                self.player = player
                self.playerItem = item
                self.currentSourceKind = resolvedSource.kind
                self.currentRadioId = resolvedSource.radioId
                self.currentMetadata = metadata
                self.addObservers(for: item, player: player)
                self.addProgressObserver(to: player)
                self.updateNowPlayingInfo()

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
            self.emitRemoteCommand("next")
            call.resolve()
        }
    }

    @objc func skipToPrevious(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.emitRemoteCommand("previous")
            call.resolve()
        }
    }

    @objc func updateMetadata(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.currentMetadata = self.metadata(from: call)
            self.updateNowPlayingInfo()
            call.resolve()
        }
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

    private func registerRemoteCommands() {
        guard remoteCommandTargets.isEmpty else {
            return
        }

        let commandCenter = MPRemoteCommandCenter.shared()

        commandCenter.playCommand.isEnabled = true
        remoteCommandTargets.append((
            commandCenter.playCommand,
            commandCenter.playCommand.addTarget { [weak self] _ in
                self?.emitRemoteCommand("play")
                return .success
            }
        ))

        commandCenter.pauseCommand.isEnabled = true
        remoteCommandTargets.append((
            commandCenter.pauseCommand,
            commandCenter.pauseCommand.addTarget { [weak self] _ in
                self?.emitRemoteCommand("pause")
                return .success
            }
        ))

        commandCenter.togglePlayPauseCommand.isEnabled = true
        remoteCommandTargets.append((
            commandCenter.togglePlayPauseCommand,
            commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
                self?.emitRemoteCommand("togglePlayPause")
                return .success
            }
        ))

        commandCenter.nextTrackCommand.isEnabled = true
        remoteCommandTargets.append((
            commandCenter.nextTrackCommand,
            commandCenter.nextTrackCommand.addTarget { [weak self] _ in
                self?.emitRemoteCommand("next")
                return .success
            }
        ))

        commandCenter.previousTrackCommand.isEnabled = true
        remoteCommandTargets.append((
            commandCenter.previousTrackCommand,
            commandCenter.previousTrackCommand.addTarget { [weak self] _ in
                self?.emitRemoteCommand("previous")
                return .success
            }
        ))

        commandCenter.changePlaybackPositionCommand.isEnabled = true
        remoteCommandTargets.append((
            commandCenter.changePlaybackPositionCommand,
            commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
                guard let event = event as? MPChangePlaybackPositionCommandEvent else {
                    return .commandFailed
                }

                self?.emitRemoteCommand("seek", position: event.positionTime)
                return .success
            }
        ))
    }

    private func unregisterRemoteCommands() {
        for target in remoteCommandTargets {
            target.command.removeTarget(target.target)
        }

        remoteCommandTargets = []
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

    private func metadata(from call: CAPPluginCall) -> NativeAudioMetadata {
        NativeAudioMetadata(
            title: call.getString("title"),
            artist: call.getString("artist"),
            album: call.getString("album"),
            duration: positiveDuration(call.getDouble("duration")),
            artworkUrl: call.getString("artworkUrl")
        )
    }

    private func metadata(from object: JSObject?) -> NativeAudioMetadata {
        guard let object else {
            return NativeAudioMetadata()
        }

        return NativeAudioMetadata(
            title: object["title"] as? String,
            artist: object["artist"] as? String,
            album: object["album"] as? String,
            duration: positiveDuration(numberValue(object["duration"])),
            artworkUrl: object["artworkUrl"] as? String
        )
    }

    private func numberValue(_ value: Any?) -> Double? {
        switch value {
        case let value as Double:
            return value
        case let value as Int:
            return Double(value)
        case let value as NSNumber:
            return value.doubleValue
        default:
            return nil
        }
    }

    private func positiveDuration(_ duration: Double?) -> Double? {
        guard let duration, duration.isFinite, duration > 0 else {
            return nil
        }

        return duration
    }

    private func updateNowPlayingInfo() {
        nowPlayingRevision += 1
        let revision = nowPlayingRevision
        artworkTask?.cancel()
        artworkTask = nil

        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        apply(currentMetadata.title, forKey: MPMediaItemPropertyTitle, to: &info)
        apply(currentMetadata.artist, forKey: MPMediaItemPropertyArtist, to: &info)
        apply(currentMetadata.album, forKey: MPMediaItemPropertyAlbumTitle, to: &info)
        applyNowPlayingPlaybackFields(to: &info)

        if currentMetadata.artworkUrl == nil {
            info.removeValue(forKey: MPMediaItemPropertyArtwork)
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info

        if let artworkUrl = currentMetadata.artworkUrl {
            loadNowPlayingArtwork(artworkUrl, revision: revision)
        }
    }

    private func updateNowPlayingPlaybackInfo() {
        guard var info = MPNowPlayingInfoCenter.default().nowPlayingInfo else {
            return
        }

        applyNowPlayingPlaybackFields(to: &info)
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func apply(_ value: String?, forKey key: String, to info: inout [String: Any]) {
        if let value, !value.isEmpty {
            info[key] = value
        } else {
            info.removeValue(forKey: key)
        }
    }

    private func applyNowPlayingPlaybackFields(to info: inout [String: Any]) {
        let duration = currentMetadata.duration ?? durationSeconds()
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        } else {
            info.removeValue(forKey: MPMediaItemPropertyPlaybackDuration)
        }

        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = seconds(
            from: player?.currentTime() ?? .zero
        )
        info[MPNowPlayingInfoPropertyPlaybackRate] =
            player?.timeControlStatus == .playing ? 1.0 : 0.0
        info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = 1.0
    }

    private func loadNowPlayingArtwork(_ urlString: String, revision: Int) {
        guard let url = URL(string: urlString) else {
            return
        }

        artworkTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard
                let self,
                let data,
                let image = UIImage(data: data)
            else {
                return
            }

            let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in
                image
            }

            DispatchQueue.main.async {
                guard self.nowPlayingRevision == revision else {
                    return
                }

                var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                info[MPMediaItemPropertyArtwork] = artwork
                MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            }
        }
        artworkTask?.resume()
    }

    private func clearNowPlayingInfo() {
        nowPlayingRevision += 1
        artworkTask?.cancel()
        artworkTask = nil
        currentMetadata = NativeAudioMetadata()
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
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
            clearNowPlayingInfo()
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
        updateNowPlayingPlaybackInfo()
    }

    private func emitProgress() {
        guard let player = player else {
            notifyListeners("progress", data: ["currentTime": 0, "duration": 0, "bufferedTime": 0])
            updateNowPlayingPlaybackInfo()
            return
        }

        let currentTime = seconds(from: player.currentTime())
        let duration = durationSeconds()

        notifyListeners("progress", data: [
            "currentTime": currentTime,
            "duration": duration,
            "bufferedTime": bufferedTime(),
        ])
        updateNowPlayingPlaybackInfo()
    }

    private func emitDuration(for item: AVPlayerItem) {
        let duration = seconds(from: item.duration)
        guard duration > 0 else {
            return
        }

        notifyListeners("durationChanged", data: ["duration": duration])
        updateNowPlayingPlaybackInfo()
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

    private func emitRemoteCommand(_ command: String, position: Double? = nil) {
        var data: JSObject = ["command": command]

        if let position {
            data["position"] = position
        }

        notifyListeners("remoteCommand", data: data)
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

private struct NativeAudioMetadata {
    var title: String?
    var artist: String?
    var album: String?
    var duration: Double?
    var artworkUrl: String?
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
