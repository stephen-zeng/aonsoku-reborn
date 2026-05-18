import Foundation
import GRDB

final class DatabaseManager {
    static let shared = DatabaseManager()

    let dbPool: DatabasePool

    private init() {
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        ).first!
        let dbDirectory = appSupport
            .appendingPathComponent("Aonsoku", isDirectory: true)
            .appendingPathComponent("Database", isDirectory: true)

        try! FileManager.default.createDirectory(
            at: dbDirectory, withIntermediateDirectories: true
        )

        let dbPath = dbDirectory.appendingPathComponent("library.sqlite").path

        var config = Configuration()
        #if DEBUG
        config.prepareDatabase { db in
            db.trace { print("[SQL] \($0)") }
        }
        #endif

        dbPool = try! DatabasePool(path: dbPath, configuration: config)

        var migrator = DatabaseMigrator()
        Migrations.registerAll(&migrator)
        try! migrator.migrate(dbPool)
    }

    var reader: DatabaseReader { dbPool }
    var writer: DatabaseWriter { dbPool }
}
