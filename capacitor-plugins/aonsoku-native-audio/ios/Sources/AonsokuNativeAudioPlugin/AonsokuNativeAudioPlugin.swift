import Foundation
import Capacitor

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

    @objc func load(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "load")
    }

    @objc func play(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "play")
    }

    @objc func pause(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "pause")
    }

    @objc func stop(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "stop")
    }

    @objc func seek(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "seek")
    }

    @objc func setRepeatMode(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "setRepeatMode")
    }

    @objc func setShuffle(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "setShuffle")
    }

    @objc func setQueue(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "setQueue")
    }

    @objc func skipToNext(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "skipToNext")
    }

    @objc func skipToPrevious(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "skipToPrevious")
    }

    @objc func updateMetadata(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "updateMetadata")
    }

    @objc func preload(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "preload")
    }

    @objc func clear(_ call: CAPPluginCall) {
        rejectNotImplemented(call, method: "clear")
    }

    private func rejectNotImplemented(_ call: CAPPluginCall, method: String) {
        call.reject(
            "AonsokuNativeAudio.\(method) is not implemented until Phase 4 playback work lands.",
            "not_implemented"
        )
    }
}
