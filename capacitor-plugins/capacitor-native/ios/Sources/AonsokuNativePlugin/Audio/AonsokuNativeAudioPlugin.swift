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
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storeAudioFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resolveAudioFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAudioFileSize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteAudioFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearAudioFiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setContextQueue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addToUserQueue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeFromUserQueue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearUserQueue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playAtIndex", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getFullState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "downloadAudioFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelDownload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getScrobbleBuffer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearScrobbleBuffer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSystemVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSystemVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVolumeHUDEnabled", returnType: CAPPluginReturnPromise),
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
    private let loadQueue = DispatchQueue(label: "com.aonsoku.NativeAudio.load", qos: .userInitiated)
    private let stateQueue = DispatchQueue(label: "com.aonsoku.NativeAudio.state", qos: .userInitiated)
    private let progressQueue = DispatchQueue(label: "com.aonsoku.NativeAudio.progress", qos: .userInitiated)
    private var wasPlayingBeforeInterruption = false
    private var repeatMode = "off"
    private var shuffleEnabled = false
    private var queueItemCount = 0
    private var queueIndex = 0
    private var currentSourceKind: String?
    private var currentRadioId: String?
    private var currentRequestId: String?
    private var playbackGeneration = 0
    private var currentMetadata = NativeAudioMetadata()
    private var loadedDurationSeconds: Double?
    private var artworkTask: URLSessionDataTask?
    private var nowPlayingRevision = 0
    private var remoteCommandTargets: [(command: MPRemoteCommand, target: Any)] = []
    private let queueEngine = NativeQueueEngine()
    private let sourceResolver = NativeSourceResolver()
    private let scrobbleBuffer = NativeScrobbleBuffer()
    private let scrobbleSubmitter = NativeScrobbleSubmitter()
    private let downloadManager = NativeDownloadManager()
    private var isQueueEngineActive = false
    private var volumeSliderView: MPVolumeView?
    private var volumeSlider: UISlider?
    private var volumeObservation: NSKeyValueObservation?
    private var isVolumeHUDEnabled = true
    private var volumeOperationGen = 0
    private var lastEmittedPlaybackState: String?

    public override func load() {
        super.load()
        queueEngine.delegate = self
        downloadManager.delegate = self
        registerLifecycleObservers()
        registerRemoteCommands()

        do {
            try configureAudioSession()
        } catch {
            emitError(code: "audio_session_failed", message: error.localizedDescription)
        }

        setupVolumeControl()
    }

    deinit {
        unregisterRemoteCommands()
        removeLifecycleObservers()
        clearPlayer(sendIdleEvent: false, deactivateSession: true)
        volumeObservation?.invalidate()
        volumeSliderView?.removeFromSuperview()
    }

    @objc func load(_ call: CAPPluginCall) {
        guard let source = call.getObject("source") else {
            reject(call, code: "invalid_source", message: "Missing audio source.")
            return
        }

        let startTime = max(0, call.getDouble("startTime") ?? 0)
        let autoplay = call.getBool("autoplay") ?? false
        let metadata = self.metadata(from: call.getObject("metadata"))
        let requestId = call.getString("requestId")

        loadQueue.async { [self] in
            do {
                let resolvedSource = try self.resolveSource(from: source)

                if autoplay {
                    try self.activateAudioSession()
                }

                DispatchQueue.main.async {
                    self.clearPlayer(sendIdleEvent: false)
                    self.playbackGeneration += 1
                    let generation = self.playbackGeneration

                    let item = AVPlayerItem(url: resolvedSource.url)
                    let player = AVPlayer(playerItem: item)
                    self.player = player
                    self.playerItem = item
                    self.currentSourceKind = resolvedSource.kind
                    self.currentRadioId = resolvedSource.radioId
                    self.currentRequestId = requestId
                    self.currentMetadata = metadata
                    self.loadedDurationSeconds = metadata.duration
                    self.addObservers(for: item, player: player, generation: generation, requestId: requestId)
                    self.addProgressObserver(to: player, generation: generation, requestId: requestId)
                    self.updateNowPlayingInfo()

                    self.emitPlaybackState("loading", requestId: requestId)

                    if startTime > 0 {
                        player.seek(to: self.makeTime(startTime))
                    }

                    if autoplay {
                        player.play()
                    }

                    call.resolve()
                }
            } catch {
                DispatchQueue.main.async {
                    self.reject(call, error: error)
                }
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
                call.resolve()
            } catch {
                self.reject(call, error: error)
            }
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.player?.pause()
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
        stateQueue.async {
            let mode = call.getString("mode") ?? "off"
            guard ["off", "one", "all"].contains(mode) else {
                self.reject(call, code: "invalid_repeat_mode", message: "Unsupported repeat mode: \(mode).")
                return
            }

            self.repeatMode = mode
            if self.isQueueEngineActive, let loopState = LoopState(rawValue: mode) {
                self.queueEngine.setLoopState(loopState)
            }
            call.resolve()
        }
    }

    @objc func setShuffle(_ call: CAPPluginCall) {
        stateQueue.async {
            let enabled = call.getBool("enabled") ?? false
            self.shuffleEnabled = enabled
            if self.isQueueEngineActive {
                self.queueEngine.setShuffleActive(enabled)
            }
            call.resolve()
        }
    }

    @objc func setQueue(_ call: CAPPluginCall) {
        stateQueue.async {
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
        stateQueue.async {
            if self.isQueueEngineActive {
                self.queueEngine.skipToNext()
            } else {
                self.emitRemoteCommand("next")
            }
            call.resolve()
        }
    }

    @objc func skipToPrevious(_ call: CAPPluginCall) {
        stateQueue.async {
            if self.isQueueEngineActive {
                let currentTime = self.player?.currentTime().seconds ?? 0
                self.queueEngine.skipToPrevious(currentTime: currentTime)
            } else {
                self.emitRemoteCommand("previous")
            }
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

    @objc func storeAudioFile(_ call: CAPPluginCall) {
        guard let songId = call.getString("songId"), !songId.isEmpty else {
            reject(call, code: "invalid_cache_request", message: "Missing songId for native audio cache storage.")
            return
        }

        guard let dataBase64 = call.getString("dataBase64"), !dataBase64.isEmpty else {
            reject(call, code: "invalid_cache_request", message: "Missing base64 audio data for native audio cache storage.")
            return
        }

        let contentType = call.getString("contentType") ?? "audio/mpeg"

        DispatchQueue.global(qos: .utility).async {
            do {
                let file = try self.storeCachedAudioFile(
                    songId: songId,
                    dataBase64: dataBase64,
                    contentType: contentType
                )
                DispatchQueue.main.async {
                    call.resolve(self.jsObject(from: file))
                }
            } catch {
                DispatchQueue.main.async {
                    self.reject(call, error: error)
                }
            }
        }
    }

    @objc func resolveAudioFile(_ call: CAPPluginCall) {
        guard let songId = call.getString("songId"), !songId.isEmpty else {
            reject(call, code: "invalid_cache_request", message: "Missing songId for native audio cache resolution.")
            return
        }

        DispatchQueue.global(qos: .utility).async {
            do {
                let file = try self.resolveCachedAudioFile(songId: songId)
                DispatchQueue.main.async {
                    call.resolve([
                        "file": file.map { self.jsObject(from: $0) } ?? NSNull(),
                    ])
                }
            } catch {
                DispatchQueue.main.async {
                    self.reject(call, error: error)
                }
            }
        }
    }

    @objc func getAudioFileSize(_ call: CAPPluginCall) {
        guard let songId = call.getString("songId"), !songId.isEmpty else {
            reject(call, code: "invalid_cache_request", message: "Missing songId for native audio cache size lookup.")
            return
        }

        DispatchQueue.global(qos: .utility).async {
            do {
                let file = try self.resolveCachedAudioFile(songId: songId)
                DispatchQueue.main.async {
                    call.resolve([
                        "sizeBytes": file?.sizeBytes.map { NSNumber(value: $0) } ?? NSNull(),
                    ])
                }
            } catch {
                DispatchQueue.main.async {
                    self.reject(call, error: error)
                }
            }
        }
    }

    @objc func deleteAudioFile(_ call: CAPPluginCall) {
        guard let songId = call.getString("songId"), !songId.isEmpty else {
            reject(call, code: "invalid_cache_request", message: "Missing songId for native audio cache deletion.")
            return
        }

        DispatchQueue.global(qos: .utility).async {
            do {
                let deleted = try self.deleteCachedAudioFile(songId: songId)
                DispatchQueue.main.async {
                    call.resolve(["deleted": deleted])
                }
            } catch {
                DispatchQueue.main.async {
                    self.reject(call, error: error)
                }
            }
        }
    }

    @objc func clearAudioFiles(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .utility).async {
            do {
                let deletedCount = try self.clearCachedAudioFiles()
                DispatchQueue.main.async {
                    call.resolve(["deletedCount": deletedCount])
                }
            } catch {
                DispatchQueue.main.async {
                    self.reject(call, error: error)
                }
            }
        }
    }

    // MARK: - Native Queue Control

    @objc func setContextQueue(_ call: CAPPluginCall) {
        stateQueue.async {
            let songsArray = call.getArray("songs") as? [[String: Any]] ?? []
            let songs = songsArray.map { QueueSong(from: $0) }
            let currentIndex = call.getInt("currentIndex") ?? 0
            let autoplay = call.getBool("autoplay") ?? true
            let startTime = call.getDouble("startTime")

            self.isQueueEngineActive = true

            if let mode = call.getString("repeatMode"), let loopState = LoopState(rawValue: mode) {
                self.queueEngine.setLoopState(loopState)
                self.repeatMode = mode
            }

            self.queueEngine.setContextQueue(
                songs: songs,
                currentIndex: currentIndex,
                autoplay: autoplay,
                startTime: startTime
            )
            call.resolve()
        }
    }

    @objc func addToUserQueue(_ call: CAPPluginCall) {
        stateQueue.async {
            let songsArray = call.getArray("songs") as? [[String: Any]] ?? []
            let songs = songsArray.map { QueueSong(from: $0) }
            let position = call.getString("position") ?? "last"

            self.queueEngine.addToUserQueue(songs: songs, position: position)
            call.resolve()
        }
    }

    @objc func removeFromUserQueue(_ call: CAPPluginCall) {
        stateQueue.async {
            let indices = call.getArray("indices") as? [Int] ?? []
            self.queueEngine.removeFromUserQueue(indices: indices)
            call.resolve()
        }
    }

    @objc func clearUserQueue(_ call: CAPPluginCall) {
        stateQueue.async {
            self.queueEngine.clearUserQueue()
            call.resolve()
        }
    }

    @objc func playAtIndex(_ call: CAPPluginCall) {
        stateQueue.async {
            let index = call.getInt("index") ?? 0
            let startTime = call.getDouble("startTime")
            self.queueEngine.playAtIndex(index, startTime: startTime)
            call.resolve()
        }
    }

    @objc func getFullState(_ call: CAPPluginCall) {
        stateQueue.async {
            let currentTime = self.seconds(from: self.player?.currentTime() ?? .zero)
            let duration = self.durationSeconds()
            let isPlaying = self.player?.timeControlStatus == .playing

            let state = self.queueEngine.getFullState(
                currentTime: currentTime,
                duration: duration,
                isPlaying: isPlaying
            )
            call.resolve(state)
        }
    }

    @objc func getScrobbleBuffer(_ call: CAPPluginCall) {
        stateQueue.async {
            let entries = self.scrobbleBuffer.getEntriesAsArray()
            call.resolve(["entries": entries])
        }
    }

    @objc func clearScrobbleBuffer(_ call: CAPPluginCall) {
        stateQueue.async {
            self.scrobbleBuffer.clear()
            call.resolve()
        }
    }

    @objc func downloadAudioFile(_ call: CAPPluginCall) {
        guard let songId = call.getString("songId"), !songId.isEmpty else {
            reject(call, code: "invalid_download_request", message: "Missing songId for audio download.")
            return
        }

        let maxBitRate = call.getInt("maxBitRate")
        let format = call.getString("format")
        downloadManager.download(songId: songId, maxBitRate: maxBitRate, format: format)
        call.resolve()
    }

    @objc func cancelDownload(_ call: CAPPluginCall) {
        if let songId = call.getString("songId") {
            downloadManager.cancel(songId: songId)
        } else {
            downloadManager.cancelAll()
        }
        call.resolve()
    }

    private func storeCachedAudioFile(
        songId: String,
        dataBase64: String,
        contentType: String
    ) throws -> NativeCachedAudioFile {
        guard let data = Data(base64Encoded: dataBase64) else {
            throw NativeAudioPluginError.invalidCacheRequest("Native audio cache data is not valid base64.")
        }

        let directory = try cacheDirectoryURL(createIfNeeded: true)
        _ = try deleteCachedAudioFile(songId: songId)

        let fileName = "\(cacheId(for: songId)).\(fileExtension(for: contentType))"
        let fileURL = directory.appendingPathComponent(fileName, isDirectory: false)
        try data.write(to: fileURL, options: [.atomic])

        let metadata = NativeCachedAudioFileMetadata(
            songId: songId,
            fileName: fileName,
            contentType: contentType,
            lastModifiedAt: Date().timeIntervalSince1970 * 1000
        )
        let metadataData = try JSONEncoder().encode(metadata)
        try metadataData.write(to: metadataURL(for: songId, in: directory), options: [.atomic])

        return try cachedAudioFile(
            songId: songId,
            directory: directory,
            metadata: metadata
        ) ?? NativeCachedAudioFile(
            songId: songId,
            uri: fileURL.absoluteString,
            contentType: contentType,
            sizeBytes: Int64(data.count),
            lastModifiedAt: metadata.lastModifiedAt
        )
    }

    private func resolveCachedAudioFile(songId: String) throws -> NativeCachedAudioFile? {
        let directory = try cacheDirectoryURL(createIfNeeded: false)
        guard FileManager.default.fileExists(atPath: directory.path) else {
            return nil
        }

        return try cachedAudioFile(songId: songId, directory: directory)
    }

    private func deleteCachedAudioFile(songId: String) throws -> Bool {
        let directory = try cacheDirectoryURL(createIfNeeded: false)
        guard FileManager.default.fileExists(atPath: directory.path) else {
            return false
        }

        let cacheId = cacheId(for: songId)
        let fileManager = FileManager.default
        let urls = try fileManager.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        )
        var deleted = false

        for url in urls where url.lastPathComponent.hasPrefix("\(cacheId).") {
            try fileManager.removeItem(at: url)
            deleted = true
        }

        return deleted
    }

    private func clearCachedAudioFiles() throws -> Int {
        let directory = try cacheDirectoryURL(createIfNeeded: false)
        guard FileManager.default.fileExists(atPath: directory.path) else {
            return 0
        }

        let fileManager = FileManager.default
        let urls = try fileManager.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        )
        var deletedAudioFileCount = 0

        for url in urls {
            if url.pathExtension != "json" {
                deletedAudioFileCount += 1
            }
            try fileManager.removeItem(at: url)
        }

        return deletedAudioFileCount
    }

    private func cachedAudioFile(
        songId: String,
        directory: URL,
        metadata: NativeCachedAudioFileMetadata? = nil
    ) throws -> NativeCachedAudioFile? {
        let resolvedMetadata: NativeCachedAudioFileMetadata?
        if let metadata {
            resolvedMetadata = metadata
        } else {
            resolvedMetadata = try readCachedAudioFileMetadata(
                songId: songId,
                directory: directory
            )
        }
        var fileURL: URL?

        if let fileName = resolvedMetadata?.fileName {
            let candidate = directory.appendingPathComponent(fileName, isDirectory: false)
            if FileManager.default.fileExists(atPath: candidate.path) {
                fileURL = candidate
            }
        }

        if fileURL == nil {
            fileURL = try findCachedAudioFileURL(songId: songId, directory: directory)
        }

        guard let fileURL else {
            return nil
        }

        let attributes = try? FileManager.default.attributesOfItem(atPath: fileURL.path)
        let sizeBytes = (attributes?[.size] as? NSNumber)?.int64Value
        let modifiedAt = (attributes?[.modificationDate] as? Date)?
            .timeIntervalSince1970

        return NativeCachedAudioFile(
            songId: songId,
            uri: fileURL.absoluteString,
            contentType: resolvedMetadata?.contentType,
            sizeBytes: sizeBytes,
            lastModifiedAt: resolvedMetadata?.lastModifiedAt ?? modifiedAt.map { $0 * 1000 }
        )
    }

    private func readCachedAudioFileMetadata(
        songId: String,
        directory: URL
    ) throws -> NativeCachedAudioFileMetadata? {
        let url = metadataURL(for: songId, in: directory)
        guard FileManager.default.fileExists(atPath: url.path) else {
            return nil
        }

        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(NativeCachedAudioFileMetadata.self, from: data)
    }

    private func findCachedAudioFileURL(songId: String, directory: URL) throws -> URL? {
        let cacheId = cacheId(for: songId)
        let urls = try FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        )

        return urls.first {
            $0.lastPathComponent.hasPrefix("\(cacheId).") && $0.pathExtension != "json"
        }
    }

    private func cacheDirectoryURL(createIfNeeded: Bool) throws -> URL {
        guard let applicationSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first else {
            throw NativeAudioPluginError.cacheFailure("Unable to locate Application Support directory.")
        }

        let directory = applicationSupport
            .appendingPathComponent("Aonsoku", isDirectory: true)
            .appendingPathComponent("AudioCache", isDirectory: true)

        if createIfNeeded {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true
            )
            var resourceURL = directory
            var resourceValues = URLResourceValues()
            resourceValues.isExcludedFromBackup = true
            try? resourceURL.setResourceValues(resourceValues)
        }

        return directory
    }

    private func metadataURL(for songId: String, in directory: URL) -> URL {
        directory.appendingPathComponent("\(cacheId(for: songId)).json", isDirectory: false)
    }

    private func cacheId(for songId: String) -> String {
        AudioCacheUtils.cacheId(for: songId)
    }

    private func fileExtension(for contentType: String) -> String {
        let normalized = contentType
            .split(separator: ";", maxSplits: 1)
            .first?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased() ?? ""

        switch normalized {
        case "audio/mpeg", "audio/mp3":
            return "mp3"
        case "audio/flac", "audio/x-flac":
            return "flac"
        case "audio/mp4", "audio/m4a", "audio/x-m4a":
            return "m4a"
        case "audio/aac":
            return "aac"
        case "audio/ogg", "application/ogg":
            return "ogg"
        case "audio/opus":
            return "opus"
        case "audio/wav", "audio/x-wav":
            return "wav"
        default:
            return "audio"
        }
    }

    private func jsObject(from file: NativeCachedAudioFile) -> JSObject {
        var object: JSObject = [
            "songId": file.songId,
            "uri": file.uri,
        ]

        if let contentType = file.contentType {
            object["contentType"] = contentType
        }
        if let sizeBytes = file.sizeBytes {
            object["sizeBytes"] = NSNumber(value: sizeBytes)
        }
        if let lastModifiedAt = file.lastModifiedAt {
            object["lastModifiedAt"] = lastModifiedAt
        }

        return object
    }

    private func configureAudioSession() throws {
        try audioSession.setCategory(.playback, mode: .default)
    }

    private func activateAudioSession() throws {
        try configureAudioSession()
        try audioSession.setActive(true)
    }

    private func deactivateAudioSession() {
        try? audioSession.setActive(false, options: [.notifyOthersOnDeactivation])
    }

    // MARK: - System Volume Control

    private func setupVolumeControl() {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }

            try? self.activateAudioSession()

            _ = self.ensureVolumeSlider(forceLayout: true)

            self.volumeObservation = self.audioSession.observe(\.outputVolume, options: [.initial, .new]) { [weak self] _, change in
                guard let self, let newVolume = change.newValue else { return }
                DispatchQueue.main.async {
                    self.notifyListeners("systemVolumeChanged", data: ["volume": newVolume])
                }
            }
        }
    }

    @objc func setSystemVolume(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }

            let value = call.getFloat("value") ?? 0.5
            let clampedValue = min(max(value, 0.0), 1.0)

            try? self.activateAudioSession()

            self.volumeOperationGen += 1
            let gen = self.volumeOperationGen

            if self.isVolumeHUDEnabled {
                let tempVolumeView = MPVolumeView(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
                self.resolveTempVolumeSlider(tempVolumeView: tempVolumeView) { [weak self] slider in
                    guard let self else { return }
                    guard let slider else {
                        call.reject(
                            "System volume control is unavailable.",
                            "volume_control_unavailable"
                        )
                        return
                    }

                    slider.setValue(clampedValue, animated: false)
                    slider.sendActions(for: .touchUpInside)
                    slider.sendActions(for: .valueChanged)

                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
                        guard let self else { return }
                        let volume = self.audioSession.outputVolume
                        self.notifyListeners("systemVolumeChanged", data: ["volume": volume])
                        call.resolve(["volume": volume])
                    }
                }
                return
            }

            self.resolveVolumeSlider { [weak self] slider in
                guard let self else { return }
                guard let slider else {
                    if self.isVolumeHUDEnabled {
                        self.removeVolumeSliderView()
                    }
                    call.reject(
                        "System volume control is unavailable.",
                        "volume_control_unavailable"
                    )
                    return
                }

                slider.setValue(clampedValue, animated: false)
                slider.sendActions(for: .touchUpInside)
                slider.sendActions(for: .valueChanged)

                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
                    guard let self else { return }
                    let volume = self.audioSession.outputVolume
                    self.notifyListeners("systemVolumeChanged", data: ["volume": volume])
                    call.resolve(["volume": volume])

                    if gen == self.volumeOperationGen, self.isVolumeHUDEnabled {
                        self.removeVolumeSliderView()
                    }
                }
            }
        }
    }

    private func resolveVolumeSlider(
        attemptsRemaining: Int = 4,
        isFirstAttempt: Bool = true,
        completion: @escaping (UISlider?) -> Void
    ) {
        if let slider = ensureVolumeSlider(forceLayout: isFirstAttempt) {
            completion(slider)
            return
        }

        guard attemptsRemaining > 0 else {
            completion(nil)
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
            guard let self else {
                completion(nil)
                return
            }

            self.resolveVolumeSlider(
                attemptsRemaining: attemptsRemaining - 1,
                isFirstAttempt: false,
                completion: completion
            )
        }
    }

    private func resolveTempVolumeSlider(
        tempVolumeView: MPVolumeView,
        attemptsRemaining: Int = 4,
        completion: @escaping (UISlider?) -> Void
    ) {
        tempVolumeView.setNeedsLayout()
        tempVolumeView.layoutIfNeeded()
        if let slider = findSlider(in: tempVolumeView) {
            completion(slider)
            return
        }

        guard attemptsRemaining > 0 else {
            completion(nil)
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
            guard let self else {
                completion(nil)
                return
            }
            self.resolveTempVolumeSlider(
                tempVolumeView: tempVolumeView,
                attemptsRemaining: attemptsRemaining - 1,
                completion: completion
            )
        }
    }

    private func ensureVolumeSlider(forceLayout: Bool = false) -> UISlider? {
        if let cached = self.volumeSlider, cached.window != nil {
            return cached
        }
        self.volumeSlider = nil

        var needsLayout = forceLayout
        if self.volumeSliderView == nil {
            guard let containerView = self.bridge?.viewController?.view else {
                return nil
            }

            let sliderView = MPVolumeView(frame: CGRect(x: -2000, y: -2000, width: 120, height: 40))
            sliderView.showsRouteButton = false
            sliderView.showsVolumeSlider = true
            sliderView.alpha = 0.001
            sliderView.isUserInteractionEnabled = false
            sliderView.accessibilityElementsHidden = true
            sliderView.clipsToBounds = true
            containerView.addSubview(sliderView)
            self.volumeSliderView = sliderView
            needsLayout = true
        }

        guard let sliderView = self.volumeSliderView else { return nil }
        if needsLayout {
            sliderView.setNeedsLayout()
            sliderView.layoutIfNeeded()
        }

        if let slider = findSlider(in: sliderView) {
            self.volumeSlider = slider
            return slider
        }

        return nil
    }

    private func findSlider(in view: UIView) -> UISlider? {
        if let slider = view as? UISlider {
            return slider
        }
        for subview in view.subviews {
            if let found = findSlider(in: subview) {
                return found
            }
        }
        return nil
    }

    @objc func getSystemVolume(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            try? self.activateAudioSession()
            let volume = self.audioSession.outputVolume
            call.resolve(["volume": volume])
        }
    }

    @objc func setVolumeHUDEnabled(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? true
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.isVolumeHUDEnabled = enabled
            if enabled {
                // Let iOS present its own volume overlay outside fullscreen.
                self.removeVolumeSliderView()
            } else {
                // Add a hidden slider view to suppress the system HUD.
                _ = self.ensureVolumeSlider()
            }
            call.resolve()
        }
    }

    private func removeVolumeSliderView() {
        volumeSlider = nil
        volumeSliderView?.removeFromSuperview()
        volumeSliderView = nil
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
                guard let self = self else { return .commandFailed }
                if self.isQueueEngineActive {
                    try? self.activateAudioSession()
                    self.player?.play()
                    self.stateQueue.async {
                        if let song = self.queueEngine.currentSong {
                            self.scrobbleBuffer.startTracking(songId: song.id, duration: song.duration)
                        }
                    }
                } else {
                    self.emitRemoteCommand("play")
                }
                return .success
            }
        ))

        commandCenter.pauseCommand.isEnabled = true
        remoteCommandTargets.append((
            commandCenter.pauseCommand,
            commandCenter.pauseCommand.addTarget { [weak self] _ in
                guard let self = self else { return .commandFailed }
                if self.isQueueEngineActive {
                    self.player?.pause()
                } else {
                    self.emitRemoteCommand("pause")
                }
                return .success
            }
        ))

        commandCenter.togglePlayPauseCommand.isEnabled = true
        remoteCommandTargets.append((
            commandCenter.togglePlayPauseCommand,
            commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
                guard let self = self else { return .commandFailed }
                if self.isQueueEngineActive {
                    if self.player?.timeControlStatus == .playing {
                        self.player?.pause()
                    } else {
                        try? self.activateAudioSession()
                        self.player?.play()
                        self.stateQueue.async {
                            if let song = self.queueEngine.currentSong {
                                self.scrobbleBuffer.startTracking(songId: song.id, duration: song.duration)
                            }
                        }
                    }
                } else {
                    self.emitRemoteCommand("togglePlayPause")
                }
                return .success
            }
        ))

        commandCenter.nextTrackCommand.isEnabled = true
        remoteCommandTargets.append((
            commandCenter.nextTrackCommand,
            commandCenter.nextTrackCommand.addTarget { [weak self] _ in
                guard let self = self else { return .commandFailed }
                if self.isQueueEngineActive {
                    self.stateQueue.async {
                        self.queueEngine.skipToNext()
                    }
                } else {
                    self.emitRemoteCommand("next")
                }
                return .success
            }
        ))

        commandCenter.previousTrackCommand.isEnabled = true
        remoteCommandTargets.append((
            commandCenter.previousTrackCommand,
            commandCenter.previousTrackCommand.addTarget { [weak self] _ in
                guard let self = self else { return .commandFailed }
                if self.isQueueEngineActive {
                    let currentTime = self.player?.currentTime().seconds ?? 0
                    self.stateQueue.async {
                        self.queueEngine.skipToPrevious(currentTime: currentTime)
                    }
                } else {
                    self.emitRemoteCommand("previous")
                }
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
                guard let self = self else { return .commandFailed }
                if self.isQueueEngineActive {
                    self.player?.seek(to: self.makeTime(event.positionTime))
                } else {
                    self.emitRemoteCommand("seek", position: event.positionTime)
                }
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
            notifyListeners("interruptionChanged", data: eventData(["type": "began"]))
            emitBuffering(false)
            emitProgress()
        case .ended:
            let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let options = AVAudioSession.InterruptionOptions(rawValue: rawOptions)
            let shouldResume = options.contains(.shouldResume)

            notifyListeners("interruptionChanged", data: eventData([
                "type": "ended",
                "shouldResume": shouldResume,
            ]))

            if shouldResume, wasPlayingBeforeInterruption, let player = player {
                do {
                    try activateAudioSession()
                    player.play()
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

        notifyListeners("routeChanged", data: eventData(["reason": reason]))
        emitCurrentPlaybackState()
        emitProgress()
    }

    private func handleApplicationVisibilityChanged() {
        emitCurrentPlaybackState()
        emitProgress()
        scrobbleSubmitter.submitPending(buffer: scrobbleBuffer)

        let volume = audioSession.outputVolume
        notifyListeners("systemVolumeChanged", data: ["volume": volume])
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
        let duration = durationSeconds()
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
        var coverArtId: String?
        if let components = URLComponents(string: urlString),
           components.scheme == "aonsoku-media",
           let queryItems = components.queryItems {
            coverArtId = queryItems.first(where: { $0.name == "id" })?.value
        }

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self else { return }

            if let coverArtId, !coverArtId.isEmpty {
                let imageCache = ImageCacheManager(db: DatabaseManager.shared.dbPool)
                if let localURL = imageCache.resolveCoverImage(coverArtId: coverArtId),
                   let data = try? Data(contentsOf: localURL),
                   let image = UIImage(data: data) {
                    let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                    DispatchQueue.main.async { [weak self] in
                        guard let self, self.nowPlayingRevision == revision else { return }
                        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                        info[MPMediaItemPropertyArtwork] = artwork
                        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
                    }
                    return
                }
            }

            guard let url = URL(string: urlString) else { return }

            let task = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
                guard let self, let data, let image = UIImage(data: data) else { return }
                let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                DispatchQueue.main.async {
                    guard self.nowPlayingRevision == revision else { return }
                    var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                    info[MPMediaItemPropertyArtwork] = artwork
                    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
                }
            }

            DispatchQueue.main.async { [weak self] in
                self?.artworkTask = task
                task.resume()
            }
        }
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
            let url = try resolveStreamURL(from: source)
            return ResolvedAudioSource(kind: kind, url: url, radioId: nil)
        case "radio":
            guard let urlString = source["url"] as? String, let url = URL(string: urlString) else {
                throw NativeAudioPluginError.invalidSource("Invalid radio stream URL.")
            }
            return ResolvedAudioSource(kind: kind, url: url, radioId: source["radioId"] as? String)
        case "blob":
            throw NativeAudioPluginError.unsupportedSource("Blob URLs are not supported by native iOS playback yet.")
        case "native-file":
            guard let uri = source["uri"] as? String, !uri.isEmpty else {
                throw NativeAudioPluginError.invalidSource("Invalid native cached audio URI.")
            }
            let url = try fileURL(from: uri)
            guard FileManager.default.fileExists(atPath: url.path) else {
                throw NativeAudioPluginError.invalidSource("Native cached audio file does not exist.")
            }
            return ResolvedAudioSource(kind: kind, url: url, radioId: nil)
        default:
            throw NativeAudioPluginError.unsupportedSource("Unsupported audio source kind: \(kind).")
        }
    }

    private func resolveStreamURL(from source: JSObject) throws -> URL {
        guard let urlString = source["url"] as? String, !urlString.isEmpty else {
            throw NativeAudioPluginError.invalidSource("Invalid audio URL.")
        }

        let isNativeMediaURL =
            URLComponents(string: urlString)?.scheme == "aonsoku-media"
        if isNativeMediaURL {
            guard let request = mediaStreamRequest(
                from: urlString,
                fallbackSongId: source["songId"] as? String
            ) else {
                throw NativeAudioPluginError.invalidSource("Invalid native media stream URL.")
            }

            guard let url = buildAuthenticatedStreamURL(from: request) else {
                throw NativeAudioPluginError.invalidSource("Unable to resolve native media stream URL.")
            }

            return url
        }

        guard let url = URL(string: urlString) else {
            throw NativeAudioPluginError.invalidSource("Invalid audio URL.")
        }

        return url
    }

    private func mediaStreamRequest(
        from urlString: String,
        fallbackSongId: String?
    ) -> NativeMediaStreamRequest? {
        guard
            let components = URLComponents(string: urlString),
            components.scheme == "aonsoku-media"
        else {
            return nil
        }

        let endpoint =
            components.host ??
            components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard endpoint == "stream" else {
            return nil
        }

        let queryItems = components.queryItems ?? []
        let songId = queryItems.first { $0.name == "id" }?.value ?? fallbackSongId
        guard let songId, !songId.isEmpty else {
            return nil
        }

        return NativeMediaStreamRequest(
            songId: songId,
            maxBitRate: queryItems.first { $0.name == "maxBitRate" }?.value,
            format: queryItems.first { $0.name == "format" }?.value
        )
    }

    private func buildAuthenticatedStreamURL(
        from request: NativeMediaStreamRequest
    ) -> URL? {
        guard let credentials = KeychainManager.retrieve() else {
            return nil
        }

        var params = SubsonicAuthBuilder.buildQueryParams(
            username: credentials.username,
            password: credentials.password,
            authType: credentials.authType,
            protocolVersion: credentials.protocolVersion
        )
        params["id"] = request.songId
        params["estimateContentLength"] = "false"

        if let maxBitRate = request.maxBitRate, !maxBitRate.isEmpty {
            params["maxBitRate"] = maxBitRate
        }
        if let format = request.format, !format.isEmpty {
            params["format"] = format
        }

        let baseString = "\(credentials.serverUrl)/rest/stream"
        guard var components = URLComponents(string: baseString) else {
            return nil
        }

        components.queryItems = params.map {
            URLQueryItem(name: $0.key, value: $0.value)
        }
        return components.url
    }

    private func fileURL(from uri: String) throws -> URL {
        if let url = URL(string: uri), url.scheme != nil {
            guard url.isFileURL else {
                throw NativeAudioPluginError.invalidSource("Native cached audio URI must be a file URL.")
            }
            return url
        }

        return URL(fileURLWithPath: uri)
    }

    private func addObservers(
        for item: AVPlayerItem,
        player: AVPlayer,
        generation: Int,
        requestId: String?
    ) {
        statusObservation = item.observe(\.status, options: [.new]) { [weak self] observedItem, _ in
            DispatchQueue.main.async {
                self?.handleStatusChanged(
                    observedItem,
                    generation: generation,
                    requestId: requestId
                )
            }
        }

        durationObservation = item.observe(\.duration, options: [.new]) { [weak self] observedItem, _ in
            DispatchQueue.main.async {
                self?.emitDuration(
                    for: observedItem,
                    generation: generation,
                    requestId: requestId
                )
            }
        }

        timeControlStatusObservation = player.observe(\.timeControlStatus, options: [.new]) { [weak self] observedPlayer, _ in
            DispatchQueue.main.async {
                self?.handleTimeControlStatusChanged(
                    observedPlayer.timeControlStatus,
                    player: observedPlayer,
                    generation: generation,
                    requestId: requestId
                )
            }
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            self?.handleEnded(generation: generation, requestId: requestId)
        }

        failedEndObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemFailedToPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] notification in
            guard self?.isCurrentPlayback(item: item, generation: generation) == true else {
                return
            }
            let error = notification.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? Error
            self?.emitError(
                code: self?.playbackErrorCode(for: error, fallback: "playback_failed") ?? "playback_failed",
                message: error?.localizedDescription ?? "Native playback failed.",
                requestId: requestId
            )
            self?.emitPlaybackState("failed", requestId: requestId)
        }

        loadDurationAsync(for: item, generation: generation, requestId: requestId)
    }

    private func addProgressObserver(
        to player: AVPlayer,
        generation: Int,
        requestId: String?
    ) {
        let interval = CMTime(seconds: 0.5, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        timeObserverToken = player.addPeriodicTimeObserver(forInterval: interval, queue: progressQueue) { [weak self] _ in
            guard self?.isCurrentPlayback(player: player, generation: generation) == true else {
                return
            }
            self?.emitProgress(requestId: requestId)
        }
    }

    private func handleStatusChanged(
        _ item: AVPlayerItem,
        generation: Int,
        requestId: String?
    ) {
        guard isCurrentPlayback(item: item, generation: generation) else {
            return
        }

        switch item.status {
        case .readyToPlay:
            emitDuration(for: item, generation: generation, requestId: requestId)
            emitBuffering(false, requestId: requestId)
        case .failed:
            emitError(
                code: playbackErrorCode(for: item.error, fallback: "load_failed"),
                message: item.error?.localizedDescription ?? "Native audio failed to load.",
                requestId: requestId
            )
            emitPlaybackState("failed", requestId: requestId)
        case .unknown:
            emitPlaybackState("loading", requestId: requestId)
        @unknown default:
            emitError(
                code: "unknown_status",
                message: "Native audio entered an unknown state.",
                requestId: requestId
            )
        }
    }

    private func handleTimeControlStatusChanged(
        _ status: AVPlayer.TimeControlStatus,
        player: AVPlayer,
        generation: Int,
        requestId: String?
    ) {
        guard isCurrentPlayback(player: player, generation: generation) else {
            return
        }

        switch status {
        case .playing:
            emitBuffering(false, requestId: requestId)
            emitPlaybackState("playing", requestId: requestId)
        case .paused:
            emitBuffering(false, requestId: requestId)
            emitPlaybackState("paused", requestId: requestId)
        case .waitingToPlayAtSpecifiedRate:
            emitBuffering(true, requestId: requestId)
        @unknown default:
            emitBuffering(false, requestId: requestId)
        }
    }

    private func handleEnded(generation: Int, requestId: String?) {
        guard isCurrentPlayback(generation: generation) else {
            return
        }

        if isQueueEngineActive {
            stateQueue.async {
                self.queueEngine.handleEnded()
            }
            return
        }

        emitProgress(requestId: requestId)
        emitPlaybackState("ended", requestId: requestId)
        notifyListeners("ended", data: eventData([
            "reason": "finished",
        ], requestId: requestId))
    }

    private func clearPlayer(sendIdleEvent: Bool, deactivateSession: Bool = false) {
        playbackGeneration += 1
        lastEmittedPlaybackState = nil

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
        loadedDurationSeconds = nil
        currentSourceKind = nil
        currentRadioId = nil
        currentRequestId = nil

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

    private func emitPlaybackState(_ state: String, requestId: String? = nil, force: Bool = false) {
        if !force && state == lastEmittedPlaybackState { return }
        lastEmittedPlaybackState = state
        notifyListeners("playbackStateChanged", data: eventData([
            "state": state,
        ], requestId: requestId))
        updateNowPlayingPlaybackInfo()
    }

    private func emitProgress(requestId: String? = nil) {
        guard let player = player else {
            notifyListeners("progress", data: eventData([
                "currentTime": 0,
                "duration": 0,
                "bufferedTime": 0,
            ], requestId: requestId))
            return
        }

        let currentTime = seconds(from: player.currentTime())
        let duration = durationSeconds()

        notifyListeners("progress", data: eventData([
            "currentTime": currentTime,
            "duration": duration,
            "bufferedTime": bufferedTime(),
        ], requestId: requestId))
    }

    private func emitDuration(
        for item: AVPlayerItem,
        generation: Int? = nil,
        requestId: String? = nil
    ) {
        if let generation, !isCurrentPlayback(item: item, generation: generation) {
            return
        }

        let duration = seconds(from: item.duration)
        guard duration > 0 else {
            return
        }

        loadedDurationSeconds = duration
        notifyListeners("durationChanged", data: eventData([
            "duration": duration,
        ], requestId: requestId))
        updateNowPlayingPlaybackInfo()
    }

    private func loadDurationAsync(
        for item: AVPlayerItem,
        generation: Int,
        requestId: String?
    ) {
        item.asset.loadValuesAsynchronously(forKeys: ["duration"]) { [weak self, weak item] in
            DispatchQueue.main.async {
                guard let self, let item else { return }
                guard self.isCurrentPlayback(item: item, generation: generation) else {
                    return
                }

                var error: NSError?
                let status = item.asset.statusOfValue(forKey: "duration", error: &error)
                guard status == .loaded else {
                    return
                }

                let duration = self.seconds(from: item.asset.duration)
                guard duration > 0 else {
                    return
                }

                self.loadedDurationSeconds = duration
                self.notifyListeners("durationChanged", data: self.eventData([
                    "duration": duration,
                ], requestId: requestId))
                self.updateNowPlayingPlaybackInfo()
            }
        }
    }

    private func emitBuffering(_ isBuffering: Bool, requestId: String? = nil) {
        notifyListeners("bufferingChanged", data: eventData([
            "isBuffering": isBuffering,
        ], requestId: requestId))
    }

    private func emitCurrentPlaybackState() {
        guard let player = player else {
            emitPlaybackState("idle", force: true)
            emitBuffering(false)
            return
        }

        switch player.timeControlStatus {
        case .playing:
            emitBuffering(false)
            emitPlaybackState("playing", force: true)
        case .paused:
            emitBuffering(false)
            emitPlaybackState("paused", force: true)
        case .waitingToPlayAtSpecifiedRate:
            emitBuffering(true)
            emitPlaybackState("loading", force: true)
        @unknown default:
            emitBuffering(false)
        }
    }

    private func emitError(
        code: String,
        message: String,
        requestId: String? = nil
    ) {
        notifyListeners("error", data: eventData([
            "code": code,
            "message": message,
        ], requestId: requestId))
    }

    private func emitRemoteCommand(_ command: String, position: Double? = nil) {
        var data: JSObject = eventData(["command": command])

        if let position {
            data["position"] = position
        }

        notifyListeners("remoteCommand", data: data)
    }

    private func eventData(_ data: JSObject, requestId: String? = nil) -> JSObject {
        var resolvedData = data

        if let requestId = requestId ?? currentRequestId {
            resolvedData["requestId"] = requestId
        }

        return resolvedData
    }

    private func isCurrentPlayback(generation: Int) -> Bool {
        generation == playbackGeneration
    }

    private func isCurrentPlayback(item: AVPlayerItem, generation: Int) -> Bool {
        guard let currentItem = playerItem else {
            return false
        }

        return isCurrentPlayback(generation: generation) && item === currentItem
    }

    private func isCurrentPlayback(player observedPlayer: AVPlayer, generation: Int) -> Bool {
        guard let currentPlayer = player else {
            return false
        }

        return isCurrentPlayback(generation: generation) && observedPlayer === currentPlayer
    }

    private func playbackErrorCode(for error: Error?, fallback: String) -> String {
        guard let error else {
            return fallback
        }

        let nsError = error as NSError

        if nsError.domain == NSURLErrorDomain {
            switch nsError.code {
            case NSURLErrorCancelled:
                return "aborted"
            case NSURLErrorNotConnectedToInternet:
                return "not_connected_to_internet"
            case NSURLErrorTimedOut:
                return "timed_out"
            case NSURLErrorCannotConnectToHost:
                return "cannot_connect_to_host"
            case NSURLErrorCannotFindHost, NSURLErrorDNSLookupFailed:
                return "cannot_find_host"
            case NSURLErrorDataNotAllowed:
                return "data_not_allowed"
            default:
                return "network"
            }
        }

        if nsError.domain == AVFoundationErrorDomain {
            return "decode_failed"
        }

        return fallback
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
        if let duration = currentMetadata.duration, duration > 0 {
            return duration
        }

        if let item = playerItem {
            let itemDuration = seconds(from: item.duration)
            if itemDuration > 0 {
                return itemDuration
            }
        }

        return loadedDurationSeconds ?? 0
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

    private func resolveCoverArtId(for song: QueueSong) -> String? {
        let useAlbumCover = PreferencesManager.shared.getNestedBool(
            store: "player_store",
            path: ["settings", "coverArt", "useAlbumCoverForSongs"]
        ) ?? false
        if useAlbumCover, let albumId = song.albumId, !albumId.isEmpty {
            return albumId
        }
        if let coverArtId = song.coverArtId, !coverArtId.isEmpty {
            return coverArtId
        }
        return nil
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

private struct NativeMediaStreamRequest {
    let songId: String
    let maxBitRate: String?
    let format: String?
}

private struct NativeAudioMetadata {
    var title: String?
    var artist: String?
    var album: String?
    var duration: Double?
    var artworkUrl: String?
}

private struct NativeCachedAudioFile {
    var songId: String
    var uri: String
    var contentType: String?
    var sizeBytes: Int64?
    var lastModifiedAt: Double?
}

struct NativeCachedAudioFileMetadata: Codable {
    var songId: String
    var fileName: String
    var contentType: String?
    var lastModifiedAt: Double
}

private enum NativeAudioPluginError: LocalizedError {
    case invalidSource(String)
    case unsupportedSource(String)
    case invalidCacheRequest(String)
    case cacheFailure(String)

    var code: String {
        switch self {
        case .invalidSource:
            return "invalid_source"
        case .unsupportedSource:
            return "unsupported_source"
        case .invalidCacheRequest:
            return "invalid_cache_request"
        case .cacheFailure:
            return "cache_failure"
        }
    }

    var errorDescription: String? {
        switch self {
        case .invalidSource(let message):
            return message
        case .unsupportedSource(let message):
            return message
        case .invalidCacheRequest(let message):
            return message
        case .cacheFailure(let message):
            return message
        }
    }
}

// MARK: - NativeQueueEngineDelegate

extension AonsokuNativeAudioPlugin: NativeQueueEngineDelegate {
    func queueEngine(_ engine: NativeQueueEngine, loadSong song: QueueSong, autoplay: Bool, startTime: Double?) {
        if let entry = scrobbleBuffer.stopTracking() {
            scrobbleSubmitter.submitIfEligible(
                entry: ScrobbleEntry(songId: entry.songId, playedDurationMs: entry.playedDurationMs, timestamp: entry.timestamp),
                songDurationSeconds: entry.timestamp
            )
        }

        playbackGeneration += 1
        let generation = playbackGeneration

        loadQueue.async { [self] in
            guard let resolved = self.sourceResolver.resolveSource(for: song) else {
                DispatchQueue.main.async {
                    if KeychainManager.retrieve() == nil {
                        self.emitError(code: "missing_credentials", message: "Cannot resolve audio source: Keychain credentials are missing. Please re-configure the server.")
                    } else {
                        self.emitError(code: "invalid_source", message: "Cannot resolve audio source for song: \(song.id)")
                    }
                }
                return
            }

            do {
                try self.configureAudioSession()
                if autoplay {
                    try self.activateAudioSession()
                }
            } catch {
                DispatchQueue.main.async {
                    self.emitError(code: "audio_session_failed", message: error.localizedDescription)
                }
                return
            }

            DispatchQueue.main.async {
                guard self.playbackGeneration == generation else { return }

                self.clearPlayer(sendIdleEvent: false)
                self.playbackGeneration = generation

                let item = AVPlayerItem(url: resolved.url)
                let player = AVPlayer(playerItem: item)
                self.player = player
                self.playerItem = item
                self.currentSourceKind = resolved.kind
                self.currentRadioId = nil
                self.currentRequestId = nil

                var metadata = NativeAudioMetadata()
                metadata.title = song.title
                metadata.artist = song.artist
                metadata.album = song.album
                metadata.duration = song.duration
                metadata.artworkUrl = self.resolveCoverArtId(for: song)
                self.currentMetadata = metadata
                self.loadedDurationSeconds = metadata.duration

                self.addObservers(for: item, player: player, generation: generation, requestId: nil)
                self.addProgressObserver(to: player, generation: generation, requestId: nil)
                self.updateNowPlayingInfo()

                self.emitPlaybackState("loading")

                if let startTime = startTime, startTime > 0 {
                    player.seek(to: self.makeTime(startTime))
                }

                if autoplay {
                    player.play()
                    self.stateQueue.async {
                        self.scrobbleBuffer.startTracking(songId: song.id, duration: song.duration)
                    }
                }
            }
        }
    }

    func queueEngine(_ engine: NativeQueueEngine, didAdvanceTo index: Int, songId: String, reason: QueueAdvanceReason) {
        notifyListeners("queueStateChanged", data: [
            "currentIndex": index,
            "songId": songId,
            "reason": reason.rawValue,
        ])
    }

    func queueEngine(_ engine: NativeQueueEngine, didChangeContents reason: String) {
        notifyListeners("queueContentsChanged", data: [
            "reason": reason,
        ])
    }

    func queueEngineDidExhaustQueue(_ engine: NativeQueueEngine) {
        if let entry = scrobbleBuffer.stopTracking() {
            scrobbleSubmitter.submitIfEligible(
                entry: ScrobbleEntry(songId: entry.songId, playedDurationMs: entry.playedDurationMs, timestamp: entry.timestamp),
                songDurationSeconds: entry.timestamp
            )
        }
        DispatchQueue.main.async {
            self.emitPlaybackState("ended")
        }
        notifyListeners("ended", data: [
            "reason": "finished",
        ])
    }

    func queueEngine(_ engine: NativeQueueEngine, seekToStart song: QueueSong) {
        DispatchQueue.main.async {
            guard let player = self.player else { return }
            player.seek(to: CMTime.zero) { [weak self] finished in
                guard finished, let self = self else { return }
                player.play()
                self.stateQueue.async {
                    if let entry = self.scrobbleBuffer.stopTracking() {
                        self.scrobbleSubmitter.submitIfEligible(
                            entry: ScrobbleEntry(songId: entry.songId, playedDurationMs: entry.playedDurationMs, timestamp: entry.timestamp),
                            songDurationSeconds: entry.timestamp
                        )
                    }
                    self.scrobbleBuffer.startTracking(songId: song.id, duration: song.duration)
                }
            }
        }
    }
}

// MARK: - NativeDownloadManagerDelegate

extension AonsokuNativeAudioPlugin: NativeDownloadManagerDelegate {
    func downloadManager(_ manager: NativeDownloadManager, didProgress songId: String, loaded: Int64, total: Int64) {
        notifyListeners("downloadProgress", data: [
            "songId": songId,
            "loaded": NSNumber(value: loaded),
            "total": NSNumber(value: total),
        ])
    }

    func downloadManager(_ manager: NativeDownloadManager, didComplete songId: String, fileUrl: URL, contentType: String, sizeBytes: Int64) {
        notifyListeners("downloadCompleted", data: [
            "songId": songId,
            "uri": fileUrl.absoluteString,
            "contentType": contentType,
            "sizeBytes": NSNumber(value: sizeBytes),
        ])
    }

    func downloadManager(_ manager: NativeDownloadManager, didFail songId: String, error: Error) {
        notifyListeners("downloadFailed", data: [
            "songId": songId,
            "error": error.localizedDescription,
        ])
    }
}
