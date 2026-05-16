import AVFoundation
import Foundation
import MediaPlayer

struct AudioPlaybackState {
    var currentTime: Double = 0
    var duration: Double = 0
    var paused: Bool = true
    var buffered: Double = 0
}

class AudioService: NSObject {
    private weak var plugin: NativeAudioPlugin?
    private var player: AVPlayer?
    private var playerItem: AVPlayerItem?
    private var timeObserver: Any?
    private var statusObservation: NSKeyValueObservation?
    private var bufferedObservation: NSKeyValueObservation?
    private var replayGainEnabled = false
    private var replayGainValue: Float = 1.0

    init(plugin: NativeAudioPlugin) {
        self.plugin = plugin
        super.init()
        setupAudioSession()
        setupRemoteCommands()
    }

    // MARK: - Playback Control

    func setSrc(url: String, songId: String, headers: [String: String]?) {
        guard let audioUrl = URL(string: url) else { return }

        let asset: AVURLAsset
        if let headers = headers, !headers.isEmpty {
            asset = AVURLAsset(url: audioUrl, options: ["AVURLAssetHTTPHeaderFieldsKey": headers])
        } else {
            asset = AVURLAsset(url: audioUrl)
        }

        let item = AVPlayerItem(asset: asset)
        removeObservers()
        playerItem = item

        if player == nil {
            player = AVPlayer(playerItem: item)
        } else {
            player?.replaceCurrentItem(with: item)
        }

        setupObservers()
        plugin?.notifyPlaybackStateChanged(state: "stopped")
    }

    func play() {
        player?.play()
        applyReplayGain()
        plugin?.notifyPlaybackStateChanged(state: "playing")
        updateNowPlayingPlaybackState()
    }

    func pause() {
        player?.pause()
        plugin?.notifyPlaybackStateChanged(state: "paused")
        updateNowPlayingPlaybackState()
    }

    func seek(to time: Double) {
        let cmTime = CMTime(seconds: time, preferredTimescale: 600)
        player?.seek(to: cmTime, toleranceBefore: .zero, toleranceAfter: .zero)
    }

    func stop() {
        player?.pause()
        removeObservers()
        player?.replaceCurrentItem(with: nil)
        playerItem = nil
        plugin?.notifyPlaybackStateChanged(state: "stopped")
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }

    func setVolume(_ volume: Float) {
        if !replayGainEnabled {
            player?.volume = volume
        }
    }

    func setReplayGain(gain: Float, enabled: Bool) {
        replayGainEnabled = enabled
        replayGainValue = gain
        applyReplayGain()
    }

    func getState() -> AudioPlaybackState {
        guard let player = player, let item = player.currentItem else {
            return AudioPlaybackState()
        }

        let currentTime = player.currentTime().seconds
        let duration = item.duration.seconds

        var buffered: Double = 0
        if let range = item.loadedTimeRanges.last?.timeRangeValue {
            let end = CMTimeGetSeconds(range.start) + CMTimeGetSeconds(range.duration)
            if duration > 0, !duration.isNaN {
                buffered = end / duration
            }
        }

        return AudioPlaybackState(
            currentTime: currentTime.isNaN ? 0 : currentTime,
            duration: duration.isNaN ? 0 : duration,
            paused: player.rate == 0,
            buffered: buffered
        )
    }

    func preload(url: String, songId: String, headers: [String: String]?) {
        // TODO: Implement preloading with a secondary player item
    }

    // MARK: - Media Metadata

    func setMediaMetadata(title: String, artist: String, album: String, artworkUrl: String?, duration: Double?) {
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: artist,
            MPMediaItemPropertyAlbumTitle: album,
        ]

        if let duration = duration {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }

        if let currentTime = player?.currentTime().seconds, !currentTime.isNaN {
            info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
        }

        info[MPNowPlayingInfoPropertyPlaybackRate] = player?.rate ?? 0

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info

        if let artworkUrl = artworkUrl, let url = URL(string: artworkUrl) {
            loadArtwork(from: url) { image in
                guard let image = image else { return }
                let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                var current = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                current[MPMediaItemPropertyArtwork] = artwork
                MPNowPlayingInfoCenter.default().nowPlayingInfo = current
            }
        }
    }

    // MARK: - Private

    private func setupAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default)
            try session.setActive(true)
        } catch {
            print("[NativeAudio] Failed to setup audio session: \(error)")
        }

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruption),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRouteChange),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
    }

    private func setupRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()

        center.playCommand.addTarget { [weak self] _ in
            self?.plugin?.notifyMediaSessionAction(action: "play", seekTime: nil)
            return .success
        }

        center.pauseCommand.addTarget { [weak self] _ in
            self?.plugin?.notifyMediaSessionAction(action: "pause", seekTime: nil)
            return .success
        }

        center.nextTrackCommand.addTarget { [weak self] _ in
            self?.plugin?.notifyMediaSessionAction(action: "nextTrack", seekTime: nil)
            return .success
        }

        center.previousTrackCommand.addTarget { [weak self] _ in
            self?.plugin?.notifyMediaSessionAction(action: "previousTrack", seekTime: nil)
            return .success
        }

        center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let posEvent = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            self?.plugin?.notifyMediaSessionAction(action: "seekTo", seekTime: posEvent.positionTime)
            return .success
        }
    }

    private func setupObservers() {
        guard let player = player, let item = playerItem else { return }

        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.5, preferredTimescale: 600),
            queue: .main
        ) { [weak self] time in
            guard let self = self,
                  let duration = self.playerItem?.duration.seconds,
                  !duration.isNaN else { return }
            self.plugin?.notifyTimeUpdate(currentTime: time.seconds, duration: duration)
            self.updateNowPlayingTime()
        }

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(playerDidFinishPlaying),
            name: .AVPlayerItemDidPlayToEndTime,
            object: item
        )

        bufferedObservation = item.observe(\.loadedTimeRanges, options: [.new]) { [weak self] item, _ in
            guard let self = self,
                  let range = item.loadedTimeRanges.last?.timeRangeValue else { return }
            let duration = item.duration.seconds
            guard duration > 0, !duration.isNaN else { return }
            let end = CMTimeGetSeconds(range.start) + CMTimeGetSeconds(range.duration)
            self.plugin?.notifyBufferedProgress(buffered: end / duration)
        }

        statusObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            switch item.status {
            case .readyToPlay:
                self?.plugin?.notifyPlaybackStateChanged(state: "stopped")
            case .failed:
                let message = item.error?.localizedDescription ?? "Unknown error"
                self?.plugin?.notifyPlaybackError(code: "decode", message: message)
            default:
                break
            }
        }
    }

    private func removeObservers() {
        if let observer = timeObserver {
            player?.removeTimeObserver(observer)
            timeObserver = nil
        }
        statusObservation?.invalidate()
        statusObservation = nil
        bufferedObservation?.invalidate()
        bufferedObservation = nil
        if let item = playerItem {
            NotificationCenter.default.removeObserver(self, name: .AVPlayerItemDidPlayToEndTime, object: item)
        }
    }

    @objc private func playerDidFinishPlaying() {
        plugin?.notifyPlaybackEnded()
    }

    @objc private func handleInterruption(_ notification: Notification) {
        guard let info = notification.userInfo,
              let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }

        switch type {
        case .began:
            plugin?.notifyMediaSessionAction(action: "pause", seekTime: nil)
        case .ended:
            if let optionsValue = info[AVAudioSessionInterruptionOptionKey] as? UInt {
                let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                if options.contains(.shouldResume) {
                    plugin?.notifyMediaSessionAction(action: "play", seekTime: nil)
                }
            }
        @unknown default:
            break
        }
    }

    @objc private func handleRouteChange(_ notification: Notification) {
        guard let info = notification.userInfo,
              let reasonValue = info[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else { return }

        if reason == .oldDeviceUnavailable {
            plugin?.notifyMediaSessionAction(action: "pause", seekTime: nil)
        }
    }

    private func applyReplayGain() {
        if replayGainEnabled {
            player?.volume = replayGainValue
        }
    }

    private func updateNowPlayingPlaybackState() {
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        info[MPNowPlayingInfoPropertyPlaybackRate] = player?.rate ?? 0
        if let currentTime = player?.currentTime().seconds, !currentTime.isNaN {
            info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func updateNowPlayingTime() {
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        if let currentTime = player?.currentTime().seconds, !currentTime.isNaN {
            info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func loadArtwork(from url: URL, completion: @escaping (UIImage?) -> Void) {
        URLSession.shared.dataTask(with: url) { data, _, _ in
            DispatchQueue.main.async {
                if let data = data {
                    completion(UIImage(data: data))
                } else {
                    completion(nil)
                }
            }
        }.resume()
    }

    deinit {
        removeObservers()
        NotificationCenter.default.removeObserver(self)
    }
}
