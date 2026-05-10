import { useGrid, useVirtualizer } from "@virtual-grid/react";
import {
  Fragment,
  ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  GridViewWrapperType,
  getGridClickedItem,
  saveGridClickedItem,
} from "@/utils/gridTools";
import { getMainScrollElement } from "@/utils/scrollPageToTop";

type GridViewWrapperProps<T> = {
  list: T[];
  children: (child: T) => ReactNode;
  titleHeight?: number;
  gap?: number;
  padding?: number;
  defaultWidth?: number;
  type: GridViewWrapperType;
};

export function GridViewWrapper<T>({
  list,
  children,
  titleHeight = 40,
  gap = 16,
  padding = 32,
  defaultWidth = 181,
  type,
}: GridViewWrapperProps<T>) {
  const gridWrapperRef = useRef<HTMLDivElement | null>(null);
  const scrollDivRef = useRef<HTMLElement | null>(null);
  const [gridColumnsSize, setGridColumnsSize] = useState(4);
  const [effectivePadding, setEffectivePadding] = useState(padding);
  const [effectiveGap, setEffectiveGap] = useState(gap);
  const [size, setSize] = useState({
    width: defaultWidth,
    height: defaultWidth + titleHeight,
  });
  const initialScrollRestored = useRef(false);
  const isScrollingSaved = useRef(false);
  const initialMeasurementDone = useRef(false);

  const routeKey = location.pathname + location.search;

  const rows = useMemo(
    () => Math.ceil(list.length / gridColumnsSize),
    [gridColumnsSize, list.length],
  );

  useLayoutEffect(() => {
    scrollDivRef.current = getMainScrollElement();

    const handleResize = () => {
      const viewportWidth = window.innerWidth;

      const newColumns =
        viewportWidth >= 1536
          ? 8
          : viewportWidth >= 1024
            ? 6
            : viewportWidth >= 768
              ? 4
              : viewportWidth >= 480
                ? 3
                : 2;
      setGridColumnsSize(newColumns);

      const isMobileView = viewportWidth < 768;
      const newEffectivePadding = isMobileView ? 16 : padding;
      const newEffectiveGap = isMobileView ? 12 : gap;
      setEffectivePadding(newEffectivePadding);
      setEffectiveGap(newEffectiveGap);

      if (gridWrapperRef.current) {
        const pageWidth = gridWrapperRef.current.clientWidth;
        const gapsDifference = (newColumns - 1) * newEffectiveGap;
        const bothSidesPaddingSize = newEffectivePadding * 2;
        const remainSpace = pageWidth - bothSidesPaddingSize - gapsDifference;
        const newWidth = Math.max(0, remainSpace) / newColumns;
        setSize({ width: newWidth, height: newWidth + titleHeight });
      } else {
        setSize({ width: defaultWidth, height: defaultWidth + titleHeight });
      }
    };

    let animationFrameId: number;

    const resizeHandler = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = requestAnimationFrame(handleResize);
    };

    handleResize();
    window.addEventListener("resize", resizeHandler);

    const resizeObserver =
      "ResizeObserver" in window ? new ResizeObserver(resizeHandler) : null;
    if (gridWrapperRef.current) {
      resizeObserver?.observe(gridWrapperRef.current);
    }

    return () => {
      window.removeEventListener("resize", resizeHandler);
      resizeObserver?.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, [padding, gap, defaultWidth, titleHeight]);

  const grid = useGrid({
    scrollRef: scrollDivRef,
    count: list.length,
    totalCount: list.length,
    columns: gridColumnsSize,
    rows,
    size,
    padding: {
      x: effectivePadding,
    },
    gap: effectiveGap,
    overscan: 5,
  });

  const rowVirtualizer = useVirtualizer(grid.rowVirtualizer);
  const columnVirtualizer = useVirtualizer(grid.columnVirtualizer);

  // biome-ignore lint/correctness/useExhaustiveDependencies: initial grid measurement
  useLayoutEffect(() => {
    rowVirtualizer.measure();
    columnVirtualizer.measure();

    initialMeasurementDone.current = true;
  }, [
    rowVirtualizer,
    columnVirtualizer,
    grid.virtualItemHeight,
    grid.virtualItemWidth,
  ]);

  // Restoring scroll position
  useLayoutEffect(() => {
    // Awaits initial measurement before restoring
    if (!initialMeasurementDone.current || initialScrollRestored.current)
      return;

    const savedRowPosition = getGridClickedItem({ name: type });
    if (!savedRowPosition) {
      initialScrollRestored.current = true;
      return;
    }

    const offsetTop = savedRowPosition[routeKey] ?? 0;
    if (offsetTop <= 0) {
      initialScrollRestored.current = true;
      return;
    }

    // 50ms timeout to ensure the grid was rendered
    setTimeout(() => {
      rowVirtualizer.scrollToOffset(offsetTop);
      initialScrollRestored.current = true;

      // 100ms timeout to allow saving scroll position again avoiding saving wrong offsets
      setTimeout(() => {
        isScrollingSaved.current = false;
      }, 100);
    }, 50);

    // Prevent scroll saves while restoring the scroll
    isScrollingSaved.current = true;
  }, [routeKey, rowVirtualizer, type]);

  // Saving scroll position
  useEffect(() => {
    if (isScrollingSaved.current || !initialScrollRestored.current || !routeKey)
      return;

    const offsetTop = rowVirtualizer.scrollOffset ?? 0;
    if (offsetTop <= 0) return;

    saveGridClickedItem({
      name: type,
      offsetTop,
      routeKey,
    });
  }, [routeKey, rowVirtualizer.scrollOffset, type]);

  return (
    <div ref={gridWrapperRef} className="w-full overflow-hidden relative">
      <div
        style={{
          width: columnVirtualizer.getTotalSize(),
          height: rowVirtualizer.getTotalSize(),
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <Fragment key={virtualRow.key}>
            {columnVirtualizer.getVirtualItems().map((virtualColumn) => {
              const item = grid.getVirtualItem({
                row: virtualRow,
                column: virtualColumn,
              });

              if (!item) return null;

              const child = list[item.index];

              return (
                <div key={virtualColumn.key} style={item.style}>
                  {children(child)}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
