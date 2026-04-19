const playlist = {
  all: ["playlists"] as const,
  single: ["playlists", "single"] as const,
};

const album = {
  all: ["albums"] as const,
  single: ["albums", "single"] as const,
  info: ["albums", "info"] as const,
  moreAlbums: ["albums", "artist-albums"] as const,
  genreAlbums: ["albums", "genre"] as const,
  recentlyAdded: ["albums", "recently-added"] as const,
  mostPlayed: ["albums", "most-played"] as const,
  recentlyPlayed: ["albums", "recently-played"] as const,
  random: ["albums", "random"] as const,
};

const artist = {
  all: ["artists"] as const,
  single: ["artists", "single"] as const,
  info: ["artists", "info"] as const,
  topSongs: ["artists", "top-songs"] as const,
};

const favorites = {
  count: ["favorites", "count"] as const,
  list: ["favorites", "list"] as const,
};

const song = {
  all: ["songs"] as const,
  random: ["songs", "random"] as const,
  info: ["songs", "info"] as const,
  count: ["songs", "count"] as const,
};

const radio = {
  all: ["radios"] as const,
};

const search = ["search"] as const;

const genre = ["genres"] as const;

const lyrics = {
  plain: ["lyrics", "plain"] as const,
  structured: ["lyrics", "structured"] as const,
};

const server = {
  scanStatus: ["server", "scan-status"] as const,
  startScan: ["server", "start-scan"] as const,
};

const update = {
  serverInfo: ["update", "server-info"] as const,
  check: ["update", "check"] as const,
};

export const queryKeys = {
  album,
  artist,
  favorites,
  playlist,
  song,
  radio,
  search,
  genre,
  lyrics,
  server,
  update,
};
