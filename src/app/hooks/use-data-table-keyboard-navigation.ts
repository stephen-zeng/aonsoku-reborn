import { Row, Table } from "@tanstack/react-table";
import { useCallback } from "react";

interface UseDataTableKeyboardNavigationProps<TData> {
  table: Table<TData>;
  rows: Row<TData>[];
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  setLastRowSelected: (index: number | null) => void;
  allowRowSelection?: boolean;
  virtualizer?: {
    scrollToIndex: (index: number, options?: { align: "start" | "center" | "end" | "auto" }) => void;
  };
}

export function useDataTableKeyboardNavigation<TData>({
  table,
  rows,
  tableContainerRef,
  setLastRowSelected,
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

      const nextIndex = e.key === "ArrowUp" ? currentIndex - 1 : currentIndex + 1;
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
              table.setRowSelection({ [rows[nextIndex].index]: true });
              setLastRowSelected(rows[nextIndex].index);
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
            table.setRowSelection({ [rows[nextIndex].index]: true });
            setLastRowSelected(rows[nextIndex].index);
          }
        }
      }
    },
    [allowRowSelection, rows, table, tableContainerRef, setLastRowSelected, virtualizer],
  );

  return { handleTableKeyDown };
}
