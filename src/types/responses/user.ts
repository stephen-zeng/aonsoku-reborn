export interface IUser {
  username: string;
  email?: string;
  scrobblingEnabled?: boolean;
  adminRole?: boolean;
  settingsRole?: boolean;
  downloadRole?: boolean;
  uploadRole?: boolean;
  playlistRole?: boolean;
  coverArtRole?: boolean;
  commentRole?: boolean;
  podcastRole?: boolean;
  streamRole?: boolean;
  jukeboxRole?: boolean;
  shareRole?: boolean;
  videoConversionRole?: boolean;
  folder?: number[];
}

interface GetUserResponse {
  user: IUser;
}

export type { GetUserResponse };
