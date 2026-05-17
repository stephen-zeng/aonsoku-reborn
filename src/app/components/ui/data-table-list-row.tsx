import { Cell, flexRender, Row } from "@tanstack/react-table";
import clsx from "clsx";
import { MouseEvent, memo, TouchEvent, useMemo, useRef, useState } from "react";
import { ContextMenuProvider } from "@/app/components/table/context-menu";
import { usePlayerCurrentSong } from "@/store/player.store";
import { ColumnDefType } from "@/types/react-table/columnDef";

const MemoContextMenuProvider = memo(ContextMenuProvider);
const MemoTableCell = memo(TableCell) as typeof TableCell;

interface TableRowProps<TData> {
  row: Row<TData>;
  virtualRow: { index: number; size: number; start: number };
  handleClicks: (e: MouseEvent<HTMLDivElement>, row: Row<TData>) => void;
  handleRowDbClick: (e: MouseEvent<HTMLDivElement>, row: Row<TData>) => void;
  handleRowTap: (e: TouchEvent<HTMLDivElement>, row: Row<TData>) => void;
  handleRowKeyDown: (
    e: React.KeyboardEvent<HTMLDivElement>,
    row: Row<TData>,
  ) => void;
  getContextMenuOptions: (row: Row<TData>) => JSX.Element | undefined;
  dataType?: "song" | "artist" | "playlist" | "radio";
  pageType?: "general" | "queue";
}

export function TableListRow<TData>({
  row,
  virtualRow,
  handleClicks,
  handleRowDbClick,
  handleRowTap,
  handleRowKeyDown,
  getContextMenuOptions,
  dataType = "song",
  pageType = "general",
}: TableRowProps<TData>) {
  const currentSong = usePlayerCurrentSong();
  const tapStateRef = useRef({
    isTap: false,
    tapTimeout: null as ReturnType<typeof setTimeout> | null,
  });
  const [isPressed, setIsPressed] = useState(false);

  // @ts-expect-error row type
  const songId = row.original.id as string;

  function handleTouchStart() {
    setIsPressed(true);
    tapStateRef.current.isTap = true;
    tapStateRef.current.tapTimeout = setTimeout(() => {
      tapStateRef.current.isTap = false;
    }, 500);
  }

  function handleTouchMove() {
    setIsPressed(false);
    tapStateRef.current.isTap = false;
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    setIsPressed(false);
    if (tapStateRef.current.tapTimeout) {
      clearTimeout(tapStateRef.current.tapTimeout);
    }
    if (tapStateRef.current.isTap) {
      // Check if the touch target is within a button, interactive element, or menu
      const target = e.target as HTMLElement;
      const isButton = target.closest("button");
      const isInteractive = target.closest('[role="button"]');
      const isMenuContent = target.closest("[data-radix-menu-content]");

      // Don't trigger the row tap if touching a button, interactive element, or menu
      if (!isButton && !isInteractive && !isMenuContent) {
        handleRowTap(e, row);
      }
    }
  }

  function handleTouchCancel() {
    setIsPressed(false);
    if (tapStateRef.current.tapTimeout) {
      clearTimeout(tapStateRef.current.tapTimeout);
    }
    tapStateRef.current.isTap = false;
  }

  const isRowSongActive = useMemo(() => {
    if (dataType !== "song") return false;

    return songId === currentSong?.id;
  }, [currentSong?.id, dataType, songId]);

  const isQueue = pageType === "queue";

  return (
    <MemoContextMenuProvider options={getContextMenuOptions(row)}>
      <div
        role="row"
        tabIndex={0}
        data-test-id="table-row"
        data-row-index={virtualRow.index}
        data-state={row.getIsSelected() && "selected"}
        onClick={(e) => handleClicks(e, row)}
        onDoubleClick={(e) => handleRowDbClick(e, row)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onContextMenu={(e) => handleClicks(e, row)}
        onKeyDown={(e) => handleRowKeyDown(e, row)}
        className={clsx(
          "group/tablerow w-[calc(100%-10px)] flex flex-row",
          "md:data-[state=selected]:bg-primary/75 hover-supported:bg-muted focus:outline-none",
          isPressed && "bg-muted",
          isQueue && "rounded-md",
          isRowSongActive && "row-active",
        )}
        style={{
          height: `${virtualRow.size}px`,
          position: "absolute",
          top: virtualRow.start,
        }}
      >
        {row.getVisibleCells().map((cell) => (
          <MemoTableCell key={cell.id} cell={cell} />
        ))}
      </div>
    </MemoContextMenuProvider>
  );
}

interface TableCellProps<TData, TValue> {
  cell: Cell<TData, TValue>;
}

function TableCell<TData, TValue>({ cell }: TableCellProps<TData, TValue>) {
  const columnDef = cell.column.columnDef as ColumnDefType<TData>;

  return (
    <div
      key={cell.id}
      className={clsx(
        "p-2 flex flex-row items-center justify-start [&:has([role=checkbox])]:pr-4",
        columnDef.className,
      )}
      style={columnDef.style}
      role="cell"
    >
      {flexRender(columnDef.cell, cell.getContext())}
    </div>
  );
}
