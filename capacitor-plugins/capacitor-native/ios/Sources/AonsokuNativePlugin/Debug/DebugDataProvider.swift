import AVFoundation
import Capacitor

struct AudioDebugSnapshot {
    let title: String?
    let artist: String?
    let album: String?
    let isPlaying: Bool
    let currentTime: Double
    let duration: Double
    let bufferedTime: Double
    let sourceKind: String?
    let bufferEmpty: Bool
    let likelyToKeepUp: Bool
    let recoveryState: String
    let repeatMode: String
    let shuffleEnabled: Bool
    let queueIndex: Int
    let queueItemCount: Int
}

struct ConnectionDebugSnapshot {
    let serverUrl: String
    let username: String
    let authType: String
    let protocolVersion: String
    let serverType: String
    let hasFallbackUrl: Bool
}

struct AudioSessionSnapshot {
    let category: String
    let mode: String
    let isOtherAudioPlaying: Bool
    let outputVolume: Float
    let sampleRate: Double
    let outputLatency: TimeInterval
    let ioBufferDuration: TimeInterval
}

final class DebugDataProvider {
    private weak var bridge: (any CAPBridgeProtocol)?

    init(bridge: (any CAPBridgeProtocol)?) {
        self.bridge = bridge
    }

    func audioSnapshot() -> AudioDebugSnapshot? {
        guard let plugin = bridge?.plugin(withName: "AonsokuNativeAudio") as? AonsokuNativeAudioPlugin else {
            return nil
        }
        return plugin.debugSnapshot()
    }

    func connectionSnapshot() -> ConnectionDebugSnapshot? {
        guard let creds = KeychainManager.retrieve() else { return nil }
        return ConnectionDebugSnapshot(
            serverUrl: creds.serverUrl,
            username: creds.username,
            authType: creds.authType,
            protocolVersion: creds.protocolVersion,
            serverType: creds.serverType,
            hasFallbackUrl: creds.fallbackUrl != nil
        )
    }

    func audioSessionSnapshot() -> AudioSessionSnapshot {
        let session = AVAudioSession.sharedInstance()
        return AudioSessionSnapshot(
            category: session.category.rawValue,
            mode: session.mode.rawValue,
            isOtherAudioPlaying: session.isOtherAudioPlaying,
            outputVolume: session.outputVolume,
            sampleRate: session.sampleRate,
            outputLatency: session.outputLatency,
            ioBufferDuration: session.ioBufferDuration
        )
    }

    func memoryUsageMB() -> Double {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        guard result == KERN_SUCCESS else { return 0 }
        return Double(info.resident_size) / (1024 * 1024)
    }
}
