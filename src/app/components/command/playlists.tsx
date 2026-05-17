import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { CachedImage } from "@/app/components/cover-image/cached-image";
import { Dot } from "@/app/components/dot";
import { CommandGroup, CommandItem } from "@/app/components/ui/command";
import { offlineData, useOfflineQuery } from "@/lib/offlineQueryClient";
import { ROUTES } from "@/routes/routesList";
import { subsonic } from "@/service/subsonic";
import { Playlist } from "@/types/responses/playlist";
import { convertSecondsToHumanRead } from "@/utils/convertSecondsToTime";
import { queryKeys } from "@/utils/queryKeys";
import { CommandItemProps } from "./command-menu";

export function CommandPlaylists({ runCommand }: CommandItemProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: playlists } = useOfflineQuery(
    [...queryKeys.playlist.all],
    subsonic.playlists.getAll,
    { offlineFn: offlineData.playlists },
  );

  if (!playlists || playlists.length === 0) return null;

  return (
    <CommandGroup heading={t("sidebar.playlists")}>
      {playlists.map((playlist) => (
        <CommandItem
          key={playlist.id}
          value={playlist.name}
          onSelect={() =>
            runCommand(() => navigate(ROUTES.PLAYLIST.PAGE(playlist.id)))
          }
        >
          <PlaylistItem playlist={playlist} />
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

function PlaylistItem({ playlist }: { playlist: Playlist }) {
  const { t } = useTranslation();

  const hasSongs = playlist.songCount > 0;
  const duration = convertSecondsToHumanRead(playlist.duration);

  const songCount = hasSongs
    ? t("playlist.songCount", { count: playlist.songCount })
    : null;

  const playlistDuration = hasSongs
    ? t("playlist.duration", { duration })
    : null;

  return (
    <div className="truncate flex items-center gap-2">
      <CachedImage
        effect="opacity"
        coverArtId={playlist.coverArt}
        coverArtType="playlist"
        coverArtSize="300"
        alt={playlist.name}
        className="bg-accent w-12 min-w-12 h-12 aspect-square rounded shadow-custom-5 text-transparent"
      />
      <div className="truncate">
        <p className="truncate">{playlist.name}</p>
        <div className="flex items-center text-xs text-muted-foreground">
          <span>{songCount}</span>
          {hasSongs && <Dot className="text-muted-foreground" />}
          <span>{playlistDuration}</span>
        </div>
      </div>
    </div>
  );
}
