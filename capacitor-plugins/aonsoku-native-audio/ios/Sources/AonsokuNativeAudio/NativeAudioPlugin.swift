import Foundation
import Capacitor

@objc(NativeAudioPlugin)
public class NativeAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAudioPlugin"
    public let jsName = "NativeAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSrc", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seek", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setReplayGain", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMediaMetadata", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "preload", returnType: CAPPluginReturnPromise),
    ]

    private lazy var audioService = AudioService(plugin: self)

    @objc func setSrc(_ call: CAPPluginCall) {
        guard let url = call.getString("url"),
              let songId = call.getString("songId") else {
            call.reject("Missing url or songId")
            return
        }
        let headers = call.getObject("headers") as? [String: String]
        audioService.setSrc(url: url, songId: songId, headers: headers)
        call.resolve()
    }

    @objc func play(_ call: CAPPluginCall) {
        audioService.play()
        call.resolve()
    }

    @objc func pause(_ call: CAPPluginCall) {
        audioService.pause()
        call.resolve()
    }

    @objc func seek(_ call: CAPPluginCall) {
        guard let time = call.getDouble("time") else {
            call.reject("Missing time")
            return
        }
        audioService.seek(to: time)
        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        audioService.stop()
        call.resolve()
    }

    @objc func setVolume(_ call: CAPPluginCall) {
        guard let volume = call.getFloat("volume") else {
            call.reject("Missing volume")
            return
        }
        audioService.setVolume(volume)
        call.resolve()
    }

    @objc func setReplayGain(_ call: CAPPluginCall) {
        let gain = call.getFloat("gain") ?? 1.0
        let enabled = call.getBool("enabled") ?? false
        audioService.setReplayGain(gain: gain, enabled: enabled)
        call.resolve()
    }

    @objc func getState(_ call: CAPPluginCall) {
        let state = audioService.getState()
        call.resolve([
            "currentTime": state.currentTime,
            "duration": state.duration,
            "paused": state.paused,
            "buffered": state.buffered,
        ])
    }

    @objc func setMediaMetadata(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? ""
        let artist = call.getString("artist") ?? ""
        let album = call.getString("album") ?? ""
        let artworkUrl = call.getString("artworkUrl")
        let duration = call.getDouble("duration")
        audioService.setMediaMetadata(
            title: title,
            artist: artist,
            album: album,
            artworkUrl: artworkUrl,
            duration: duration
        )
        call.resolve()
    }

    @objc func preload(_ call: CAPPluginCall) {
        guard let url = call.getString("url"),
              let songId = call.getString("songId") else {
            call.reject("Missing url or songId")
            return
        }
        let headers = call.getObject("headers") as? [String: String]
        audioService.preload(url: url, songId: songId, headers: headers)
        call.resolve()
    }

    // MARK: - Event forwarding from AudioService

    func notifyTimeUpdate(currentTime: Double, duration: Double) {
        notifyListeners("timeUpdate", data: [
            "currentTime": currentTime,
            "duration": duration,
        ])
    }

    func notifyBufferedProgress(buffered: Double) {
        notifyListeners("bufferedProgress", data: [
            "buffered": buffered,
        ])
    }

    func notifyPlaybackStateChanged(state: String) {
        notifyListeners("playbackStateChanged", data: [
            "state": state,
        ])
    }

    func notifyPlaybackEnded() {
        notifyListeners("playbackEnded", data: [:])
    }

    func notifyPlaybackError(code: String, message: String) {
        notifyListeners("playbackError", data: [
            "code": code,
            "message": message,
        ])
    }

    func notifyMediaSessionAction(action: String, seekTime: Double?) {
        var data: [String: Any] = ["action": action]
        if let seekTime = seekTime {
            data["seekTime"] = seekTime
        }
        notifyListeners("mediaSessionAction", data: data)
    }
}
