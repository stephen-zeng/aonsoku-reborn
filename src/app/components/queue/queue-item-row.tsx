import type { DraggableAttributes, SyntheticListenerMap } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { EllipsisVertical, GripVertical, PlayIcon } from "lucide-react";
import { CSSProperties, forwardRef, useState } from "react";
import { useHaptic } from "@/app/hooks/use-haptic";
import { CachedImage } from "@/app/components/cover-image/cached-image";
import { CacheButton } from "@/app/components/table/cache-button";
import { CachedIndicator } from "@/app/components/table/cached-indicator";
import { ContextMenuProvider } from "@/app/components/table/context-menu";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { ISong } from "@/types/responses/song";
import { convertSecondsToTime } from "@/utils/convertSecondsToTime";
import { ALBUM_ARTISTS_MAX_NUMBER } from "@/utils/multipleArtists";
import { QueueMenuOptions } from "./queue-menu-options";

interface QueueItemRowProps {
  song: ISong;
  isActive: boolean;
  onPlay: () => void;
  style?: CSSProperties;
  tier?: "context" | "user";
  hideDownload?: boolean;
  hideDuration?: boolean;
  hideDropdownButton?: boolean;
  isMobile?: boolean;
}

export function SortableQueueItem({
  id,
  ...props
}: QueueItemRowProps & { id: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <QueueItemRow
      ref={setNodeRef}
      {...props}
      style={style}
      dragAttributes={attributes}
      dragListeners={listeners}
    />
  );
}

interface InternalQueueItemRowProps extends QueueItemRowProps {
  dragAttributes?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
}

export const QueueItemRow = forwardRef<
  HTMLDivElement,
  InternalQueueItemRowProps
>(function QueueItemRow(
  {
    song,
    isActive,
    onPlay,
    style,
    dragAttributes,
    dragListeners,
    tier,
    hideDownload,
    hideDuration,
    hideDropdownButton,
    isMobile,
  },
  ref,
) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { trigger } = useHaptic();
  const hapticTrigger = trigger ? () => trigger() : undefined;

  const content = (
    <div
      ref={ref}
      className={clsx([
        "group/queuerow flex items-center w-full h-16 text-sm rounded-md px-3 gap-2",
        "hover-supported:bg-muted",
      ])}
      style={style}
      {...dragAttributes}
    >
      {dragListeners && !isMobile && (
        <span
          className="text-foreground/30 shrink-0 cursor-grab select-none py-2 -my-2 touch-none"
          {...dragListeners}
        >
          <GripVertical className="w-4 h-4" />
        </span>
      )}

      <div
        className="group/cover relative w-10 h-10 flex-shrink-0 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onPlay();
        }}
      >
        <div className="w-10 h-10 bg-accent rounded overflow-hidden">
          <CachedImage
            coverArtId={song.coverArt}
            coverArtType="song"
            albumId={song.albumId}
            coverArtSize="100"
            className="w-10 h-10 rounded text-transparent object-cover"
            alt={`${song.title} - ${song.artist}`}
          />
        </div>
        <div
          className={clsx(
            "absolute inset-0 flex items-center justify-center bg-black/40 rounded",
            "opacity-0 group-hover-supported/cover:opacity-100 transition-opacity",
          )}
        >
          <PlayIcon size={16} className="text-white fill-white" />
        </div>
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-semibold truncate text-sm">{song.title}</span>
        <QueueArtists song={song} />
      </div>

      <div className="relative flex-shrink-0 flex items-center justify-end gap-1">
        {!hideDownload && <CachedIndicator songId={song.id} />}
        {!hideDownload && <CacheButton songId={song.id} groupName="queuerow" />}
        {!hideDuration && (
          <span
            className={clsx(
              "text-xs transition-opacity",
              !dropdownOpen && "group-hover-supported/queuerow:opacity-0",
              dropdownOpen && "opacity-0",
            )}
          >
            {convertSecondsToTime(song.duration)}
          </span>
        )}
        {!hideDropdownButton && (
          <div className="absolute inset-0 flex items-center justify-end">
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={clsx(
                    "w-8 h-8 p-1 rounded-full",
                    "data-[state=open]:opacity-100",
                    "opacity-0 group-hover-supported/queuerow:opacity-100 transition-opacity",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <EllipsisVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <QueueMenuOptions variant="dropdown" song={song} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {dragListeners && isMobile && (
        <span
          className="text-foreground/30 shrink-0 cursor-grab select-none py-4 px-2 -my-2 -mr-2 touch-none"
          {...dragListeners}
          onTouchStart={hapticTrigger}
          onTouchEnd={hapticTrigger}
        >
          <GripVertical className="w-5 h-5" />
        </span>
      )}
    </div>
  );

  return (
    <ContextMenuProvider
      options={<QueueMenuOptions variant="context" song={song} tier={tier} />}
    >
      {content}
    </ContextMenuProvider>
  );
});

function QueueArtists({ song }: { song: ISong }) {
  const { artist, artists } = song;

  if (artists && artists.length > 1) {
    const names = artists
      .slice(0, ALBUM_ARTISTS_MAX_NUMBER)
      .map((a) => a.name)
      .join(", ");

    return (
      <span className="font-normal text-xs opacity-70 truncate">{names}</span>
    );
  }

  return (
    <span className="font-normal text-xs opacity-70 truncate">{artist}</span>
  );
}
