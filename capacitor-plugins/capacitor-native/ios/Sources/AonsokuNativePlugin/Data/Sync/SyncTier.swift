import Foundation

enum SyncTier: String, CaseIterable {
    case t1
    case t2
    case t3

    var freshWindowSeconds: TimeInterval {
        switch self {
        case .t1: return 5 * 60
        case .t2: return 30 * 60
        case .t3: return 2 * 60 * 60
        }
    }

    var freshWindowMs: Int {
        Int(freshWindowSeconds * 1000)
    }
}
