import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import {
  GridViewWrapperType,
  getGridClickedItem,
  saveGridClickedItem,
} from "@/utils/gridTools";

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
  const [gridColumnsSize, setGridColumnsSize] = useState(4);
  const [effectivePadding, setEffectivePadding] = useState(padding);
  const [effectiveGap, setEffectiveGap] = useState(gap);
  const [size, setSize] = useState({
    width: defaultWidth,
    height: defaultWidth + titleHeight,
  });
  const initialScrollRestored = useRef(false);
  const isScrollingSaved = useRef(false);

  const location = useLocation();
  const routeKey = location.pathname + location.search;

  const rowCount = useMemo(
    () => Math.ceil(list.length / gridColumnsSize),
    [gridColumnsSize, list.length],
  );

  useLayoutEffect(() => {
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

  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (gridWrapperRef.current) {
      setScrollMargin(gridWrapperRef.current.offsetTop);
    }
  }, []);

  const rowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: useCallback(
      () => size.height + effectiveGap,
      [size.height, effectiveGap],
    ),
    scrollMargin,
    overscan: 5,
  });

  // Restoring scroll position
  useLayoutEffect(() => {
    if (initialScrollRestored.current) return;

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

    // Await for virtualizer to be ready
    setTimeout(() => {
      rowVirtualizer.scrollToOffset(offsetTop);
      initialScrollRestored.current = true;

      setTimeout(() => {
        isScrollingSaved.current = false;
      }, 100);
    }, 50);

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
    <div
      ref={gridWrapperRef}
      className="w-full relative overflow-x-hidden"
      style={{
        height: `${rowVirtualizer.getTotalSize()}px`,
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => (
        <div
          key={virtualRow.key}
          className="absolute top-0 left-0 w-full flex flex-row"
          style={{
            height: `${size.height}px`,
            gap: `${effectiveGap}px`,
            paddingLeft: `${effectivePadding}px`,
            paddingRight: `${effectivePadding}px`,
            transform: `translateY(${
              virtualRow.start - rowVirtualizer.options.scrollMargin
            }px)`,
          }}
        >
          {Array.from({ length: gridColumnsSize }).map((_, columnIndex) => {
            const index = virtualRow.index * gridColumnsSize + columnIndex;
            if (index >= list.length) return null;

            const child = list[index];

            return (
              <div
                key={index}
                style={{
                  width: `${size.width}px`,
                  height: `${size.height}px`,
                }}
              >
                {children(child)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
