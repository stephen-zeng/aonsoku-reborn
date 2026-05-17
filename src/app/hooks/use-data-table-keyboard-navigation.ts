import { Row, Table } from "@tanstack/react-table";
import { type RefObject, useCallback } from "react";
import { computeMultiSelectedRows } from "@/utils/dataTable";

interface UseDataTableKeyboardNavigationProps<TData> {
  table: Table<TData>;
  rows: Row<TData>[];
  tableContainerRef: RefObject<HTMLDivElement | null>;
  setLastRowSelected: (index: number | null) => void;
  lastRowSelected: number | null;
  allowRowSelection?: boolean;
  virtualizer?: {
    scrollToIndex: (
      index: number,
      options?: { align: "start" | "center" | "end" | "auto" },
    ) => void;
  };
}

function applyRowSelection(
  table: Table<unknown>,
  rows: Row<unknown>[],
  nextIndex: number,
  lastRowSelected: number | null,
  shiftKey: boolean,
  setLastRowSelected: (index: number | null) => void,
) {
  const rowIndex = rows[nextIndex].index;

  if (shiftKey && lastRowSelected !== null) {
    table.setRowSelection(computeMultiSelectedRows(lastRowSelected, rowIndex));
  } else {
    table.setRowSelection({ [rowIndex]: true });
    setLastRowSelected(rowIndex);
  }
}

export function useDataTableKeyboardNavigation<TData>({
  table,
  rows,
  tableContainerRef,
  setLastRowSelected,
  lastRowSelected,
  allowRowSelection = true,
  virtualizer,
}: UseDataTableKeyboardNavigationProps<TData>) {
  const handleTableKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (e.defaultPrevented) return;

      const activeElement = document.activeElement;
      if (!activeElement) return;

      const currentRow = activeElement.closest<HTMLElement>("[data-row-index]");
      if (!currentRow) return;

      const currentIndex = Number(currentRow.getAttribute("data-row-index"));
      if (Number.isNaN(currentIndex)) return;

      const nextIndex =
        e.key === "ArrowUp" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= rows.length) return;

      e.preventDefault();

      if (virtualizer) {
        virtualizer.scrollToIndex(nextIndex, { align: "center" });

        let attempts = 0;
        const tryFocus = () => {
          const tableContainer = tableContainerRef.current;
          if (!tableContainer) return;
          const nextRow = tableContainer.querySelector<HTMLElement>(
            `[data-row-index="${nextIndex}"]`,
          );
          if (nextRow) {
            nextRow.focus();
            if (allowRowSelection) {
              applyRowSelection(
                table as unknown as Table<unknown>,
                rows as unknown as Row<unknown>[],
                nextIndex,
                lastRowSelected,
                e.shiftKey,
                setLastRowSelected,
              );
            }
          } else if (attempts < 10) {
            attempts++;
            requestAnimationFrame(tryFocus);
          }
        };
        requestAnimationFrame(tryFocus);
      } else {
        const tableContainer = tableContainerRef.current;
        if (!tableContainer) return;

        const nextRow = tableContainer.querySelector<HTMLElement>(
          `[data-row-index="${nextIndex}"]`,
        );
        if (nextRow) {
          nextRow.focus();
          if (allowRowSelection) {
            applyRowSelection(
              table as unknown as Table<unknown>,
              rows as unknown as Row<unknown>[],
              nextIndex,
              lastRowSelected,
              e.shiftKey,
              setLastRowSelected,
            );
          }
        }
      }
    },
    [
      allowRowSelection,
      rows,
      table,
      tableContainerRef,
      setLastRowSelected,
      lastRowSelected,
      virtualizer,
    ],
  );

  return { handleTableKeyDown };
}
