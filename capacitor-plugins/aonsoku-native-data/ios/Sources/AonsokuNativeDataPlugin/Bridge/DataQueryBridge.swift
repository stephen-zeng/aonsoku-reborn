import Foundation
import GRDB

struct DataQueryBridge {
    let db: DatabasePool

    lazy var artistRepo = ArtistRepository(db: db)
    lazy var albumRepo = AlbumRepository(db: db)
    lazy var songRepo = SongRepository(db: db)
    lazy var playlistRepo = PlaylistRepository(db: db)
    lazy var genreRepo = GenreRepository(db: db)
    lazy var cacheMetaRepo = CacheMetaRepository(db: db)
    lazy var lyricsRepo = LyricsRepository(db: db)
    lazy var syncStateRepo = SyncStateRepository(db: db)

    init(db: DatabasePool) {
        self.db = db
    }
}
