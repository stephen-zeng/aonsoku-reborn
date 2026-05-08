import { EllipsisVertical } from "lucide-react";
import { type KeyboardEvent, type ReactNode } from "react";
import { CachedImage } from "@/app/components/cover-image/cached-image";
import { EqualizerBars } from "@/app/components/icons/equalizer-bars";
import { SongMenuOptions } from "@/app/components/song/menu-options";
import { TableArtists } from "@/app/components/table/song-title";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { usePlayerCurrentSong, usePlayerIsPlaying } from "@/store/player.store";
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
    <div className={cn("flex flex-col gap-1", className)}>
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
}

export function MobileSongList({
  songs,
  onPlaySong,
  emptyMessage,
  className,
  getIndexLabel = (_song, index) => index + 1,
}: MobileSongListProps) {
  return (
    <MobileMediaList
      items={songs}
      emptyMessage={emptyMessage}
      className={className}
    >
      {(song, index) => (
        <MobileSongRow
          key={`${song.id}-${index}`}
          song={song}
          index={index}
          indexLabel={getIndexLabel(song, index)}
          onPlaySong={onPlaySong}
        />
      )}
    </MobileMediaList>
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
  const currentSong = usePlayerCurrentSong();
  const isPlaying = usePlayerIsPlaying();
  const isActive = currentSong?.id === song.id;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    onPlaySong(index);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="mobile-song-row"
      className={cn(
        "group flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left active:bg-accent/70",
        isActive && "bg-accent",
      )}
      onClick={() => onPlaySong(index)}
      onKeyDown={handleKeyDown}
    >
      <div className="relative size-10 shrink-0 overflow-hidden rounded bg-skeleton">
        <CachedImage
          coverArtId={song.coverArt}
          coverArtType="song"
          albumId={song.albumId}
          alt={`${song.artist} - ${song.title}`}
          width={40}
          height={40}
          className="h-full w-full object-cover"
        />
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-medium text-white opacity-0 transition-opacity",
            isActive && "opacity-100",
          )}
        >
          {isActive && isPlaying ? (
            <EqualizerBars size={16} className="mb-1" />
          ) : (
            indexLabel
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <span className="truncate text-sm font-medium">{song.title}</span>
        <div className="flex min-w-0 items-center truncate">
          <TableArtists song={song} />
        </div>
      </div>

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
  );
}
