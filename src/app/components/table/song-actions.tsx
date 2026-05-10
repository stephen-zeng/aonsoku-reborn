import { Row } from "@tanstack/react-table";
import { useHasHover } from "@/app/hooks/use-input-mode";
import { SongMenuOptions } from "@/app/components/song/menu-options";
import { CachedIndicator } from "@/app/components/table/cached-indicator";
import { TableActionButton } from "@/app/components/table/action-button";
import { TableLikeButton } from "@/app/components/table/like-button";
import { ISong } from "@/types/responses/song";

interface SongTableActionsProps {
  row: Row<ISong>;
}

export function SongTableActions({ row }: SongTableActionsProps) {
  const hasHover = useHasHover();

  return (
    <div className="flex gap-1 items-center">
      <TableActionButton
        optionsMenuItems={
          <SongMenuOptions
            variant="dropdown"
            song={row.original}
            index={row.index}
            showLikeOption={!hasHover}
          />
        }
      />
      <CachedIndicator songId={row.original.id} />
      {hasHover && (
        <>
          <TableLikeButton
            type="song"
            entityId={row.original.id}
            starred={typeof row.original.starred === "string"}
            albumId={row.original.albumId}
            song={row.original}
          />
        </>
      )}
    </div>
  );
}
