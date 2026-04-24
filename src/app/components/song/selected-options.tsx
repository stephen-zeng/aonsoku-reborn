import { Table } from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OptionsButtons } from "@/app/components/options/buttons";

import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/app/components/ui/context-menu";
import { useOptions } from "@/app/hooks/use-options";
import { audioKey, cacheManager } from "@/service/cache";
import { useCacheIndexStore } from "@/store/cache-index.store";
import { ROUTES } from "@/routes/routesList";
import { ISong } from "@/types/responses/song";
import { AddToPlaylistSubMenu } from "./add-to-playlist";
import { usePlayerStore } from "@/store/player.store";

interface SelectedSongsProps {
  table: Table<ISong>;
}

export function SelectedSongsMenuOptions({ table }: SelectedSongsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const songOptions = useOptions();
  const isUserQueueEmpty = usePlayerStore(
    (state) => state.songlist.userQueue.songs.length === 0,
  );

  const { rows } = table.getFilteredSelectedRowModel();
  const isSingleSelected = rows.length === 1;
  const songs = rows.map((row) => row.original);
  const firstSong = songs[0];

  function reset(action: () => void) {
    action();
    table.resetRowSelection();
  }

  async function handlePlayNext() {
    reset(() => songOptions.playNext(songs));
  }

  async function handlePlayLast() {
    reset(() => songOptions.playLast(songs));
  }

  async function handleCacheSongs() {
    for (const song of songs) {
      const key = audioKey(song.id);
      const isCached = key in useCacheIndexStore.getState().items;
      if (!isCached) {
        try {
          await cacheManager.cacheSong(song.id);
        } catch {
          // Best-effort: skip songs that fail to cache
        }
      }
    }
    reset(() => {});
  }

  async function handleRemoveCachedSongs() {
    for (const song of songs) {
      const key = audioKey(song.id);
      const isCached = key in useCacheIndexStore.getState().items;
      if (isCached) {
        await cacheManager.evictItem(key);
      }
    }
    reset(() => {});
  }

  const hasUncached = songs.some(
    (s) => !(audioKey(s.id) in useCacheIndexStore.getState().items),
  );
  const hasCached = songs.some(
    (s) => audioKey(s.id) in useCacheIndexStore.getState().items,
  );

  async function handleAddToPlaylist(id: string) {
    const songIdToAdd = songs.map((s) => s.id);

    reset(() => songOptions.addToPlaylist(id, songIdToAdd));
  }

  async function handleCreateNewPlaylist() {
    const songIdToAdd = songs.map((s) => s.id);

    reset(() => songOptions.createNewPlaylist(firstSong.title, songIdToAdd));
  }

  function handleRemoveSongsFromPlaylist() {
    const songIndexes = rows.map((row) => row.index.toString());

    reset(() => songOptions.removeSongFromPlaylist(songIndexes));
  }

  function handleSongInfoOption() {
    if (!isSingleSelected) return;

    reset(() => songOptions.openSongInfo(firstSong.id));
  }

  return (
    <>
      <OptionsButtons.PlayNext
        variant="context"
        onClick={(e) => {
          e.stopPropagation();
          handlePlayNext();
        }}
      />
      <OptionsButtons.PlayLast
        variant="context"
        disabled={isUserQueueEmpty}
        onClick={(e) => {
          e.stopPropagation();
          handlePlayLast();
        }}
      />
      <ContextMenuSeparator />
      <OptionsButtons.AddToPlaylistOption variant="context">
        <AddToPlaylistSubMenu
          type="context"
          newPlaylistFn={handleCreateNewPlaylist}
          addToPlaylistFn={handleAddToPlaylist}
        />
      </OptionsButtons.AddToPlaylistOption>
      {songOptions.isOnPlaylistPage && (
        <OptionsButtons.RemoveFromPlaylist
          variant="context"
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveSongsFromPlaylist();
          }}
        />
      )}
      {isSingleSelected && (
        <>
          <ContextMenuSeparator />
          {(firstSong.artistId || firstSong.albumId) && (
            <>
              {firstSong.artistId && (
                <OptionsButtons.GotoArtist
                  variant="context"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(ROUTES.ARTIST.PAGE(firstSong.artistId!));
                  }}
                />
              )}
              {firstSong.albumId && (
                <OptionsButtons.GotoAlbum
                  variant="context"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(ROUTES.ALBUM.PAGE(firstSong.albumId));
                  }}
                />
              )}
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuSeparator />
          <OptionsButtons.SongInfo
            variant="context"
            onClick={(e) => {
              e.stopPropagation();
              handleSongInfoOption();
            }}
          />
        </>
      )}
      <ContextMenuSeparator />
      {hasUncached && (
        <OptionsButtons.DownloadSong
          variant="context"
          onClick={(e) => {
            e.stopPropagation();
            handleCacheSongs();
          }}
        />
      )}
      {hasCached && (
        <OptionsButtons.RemoveDownload
          variant="context"
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveCachedSongs();
          }}
        />
      )}
      <ContextMenuSeparator />
      <ContextMenuItem disabled inset>
        {t("table.menu.selectedCount", { count: rows.length })}
      </ContextMenuItem>
    </>
  );
}
