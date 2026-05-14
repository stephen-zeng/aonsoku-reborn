import { Disc2Icon, EllipsisVertical } from "lucide-react";
import { type KeyboardEvent, type ReactNode, startTransition } from "react";
import { useTranslation } from "react-i18next";
import { CoverImage } from "@/app/components/table/cover-image";
import { SongMenuOptions } from "@/app/components/song/menu-options";
import { TableArtists } from "@/app/components/table/song-title";
import { CachedIndicator } from "@/app/components/table/cached-indicator";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useIsCurrentPlaying } from "@/store/player.store";
import { ISong } from "@/types/responses/song";

interface MobileMediaListProps<TItem> {
  items: TItem[];
  children: (item: TItem, index: number) => ReactNode;
  emptyMessage?: string;
  className?: string;
}

export function MobileMediaList<TItem>({
  items,
  children,
  emptyMessage,
  className,
}: MobileMediaListProps<TItem>) {
  if (items.length === 0) {
    return emptyMessage ? (
      <div className="flex min-h-24 items-center justify-center px-4 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    ) : null;
  }

  return (
    <div
      data-testid="mobile-song-list"
      className={cn("flex flex-col gap-1", className)}
    >
      {items.map((item, index) => children(item, index))}
    </div>
  );
}

interface MobileSongListProps {
  songs: ISong[];
  onPlaySong: (index: number) => void;
  emptyMessage?: string;
  className?: string;
  getIndexLabel?: (song: ISong, index: number) => number;
  showDiscNumber?: boolean;
}

export function MobileSongList({
  songs,
  onPlaySong,
  emptyMessage,
  className,
  getIndexLabel = (_song, index) => index + 1,
  showDiscNumber = false,
}: MobileSongListProps) {
  const { t } = useTranslation();

  const discNumbers = new Set(songs.map((s) => s.discNumber ?? 1));
  const hasMultipleDiscs = discNumbers.size > 1;

  if (songs.length === 0 && emptyMessage) {
    return (
      <div
        data-testid="mobile-song-list"
        className={cn("flex flex-col gap-1", className)}
      >
        <div className="flex min-h-24 items-center justify-center px-4 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="mobile-song-list"
      className={cn("flex flex-col gap-1", className)}
    >
      {songs.map((song, index) => {
        const discNum = song.discNumber ?? 1;
        const isFirstOfDisc =
          showDiscNumber &&
          hasMultipleDiscs &&
          (!songs[index - 1] || (songs[index - 1].discNumber ?? 1) !== discNum);

        return (
          <div key={`${song.id}-${index}`}>
            {isFirstOfDisc && (
              <div className="flex h-10 items-center text-muted-foreground">
                <div className="w-10 flex items-center justify-center">
                  <Disc2Icon strokeWidth={1.75} className="size-4" />
                </div>
                <span className="font-medium ml-[7px]">
                  {t("album.table.discNumber", { number: discNum })}
                </span>
              </div>
            )}
            <MobileSongRow
              song={song}
              index={index}
              indexLabel={getIndexLabel(song, index)}
              onPlaySong={onPlaySong}
            />
          </div>
        );
      })}
    </div>
  );
}

interface MobileSongRowProps {
  song: ISong;
  index: number;
  indexLabel: number;
  onPlaySong: (index: number) => void;
}

function MobileSongRow({
  song,
  index,
  indexLabel,
  onPlaySong,
}: MobileSongRowProps) {
  const isCurrentPlaying = useIsCurrentPlaying(song.id);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      startTransition(() => {
        onPlaySong(index);
      });
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const currentRow = event.currentTarget;
      const container = currentRow.closest('[data-testid="mobile-song-list"]');
      if (!container) return;

      const nextIndex = event.key === "ArrowUp" ? index - 1 : index + 1;
      const nextRow = container.querySelector<HTMLElement>(
        `[data-testid="mobile-song-row"][data-row-index="${nextIndex}"]`,
      );
      if (nextRow) {
        nextRow.focus();
      }
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="mobile-song-row"
      data-row-index={index}
      className={cn(
        "group flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors active:bg-accent/70",
      )}
      onClick={() =>
        startTransition(() => {
          onPlaySong(index);
        })
      }
      onKeyDown={handleKeyDown}
    >
      <CoverImage
        coverArt={song.coverArt}
        coverArtType="song"
        albumId={song.albumId}
        altText={`${song.artist} - ${song.title}`}
        size={40}
        isCurrentPlaying={isCurrentPlaying}
      />

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <span className="truncate text-sm font-medium">{song.title}</span>
        <div className="flex min-w-0 items-center truncate">
          <TableArtists song={song} />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <CachedIndicator songId={song.id} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 rounded-full"
              aria-label="Song options"
              data-testid="mobile-song-options"
              onClick={(event) => event.stopPropagation()}
            >
              <EllipsisVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(event) => event.stopPropagation()}
          >
            <SongMenuOptions
              variant="dropdown"
              song={song}
              index={index}
              showLikeOption={true}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
