import type { ReactNode } from "react";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useHasHover } from "@/app/hooks/use-input-mode";
import {
  getColumnLayouts,
  type TableColumnId,
  type TableColumnLayout,
  type TableKind,
  topSongsColumnIds,
} from "@/app/tables/column-layouts";
import { cn } from "@/lib/utils";

interface TableFallbackProps {
  variant?: "classic" | "modern";
  type?: "regular" | "infinity";
  length?: number;
  columns?: TableKind;
  columnIds?: readonly TableColumnId[];
}

interface FallbackCellProps {
  children?: ReactNode;
  isHeader?: boolean;
  isList?: boolean;
  layout: TableColumnLayout;
}

function FallbackCell({
  children,
  isHeader = false,
  isList = false,
  layout,
}: FallbackCellProps) {
  return (
    <div
      className={cn(
        "p-2 flex flex-row items-center justify-start min-w-0",
        isHeader && (isList ? "h-10" : "h-12"),
        layout.className,
      )}
      style={layout.style}
    >
      {children}
    </div>
  );
}

function TextSkeleton({
  className,
  size = "sm",
}: {
  className: string;
  size?: "xs" | "sm" | "badge";
}) {
  return (
    <Skeleton
      className={cn(
        "rounded",
        size === "xs" && "h-3",
        size === "sm" && "h-3.5",
        size === "badge" && "h-[22px] rounded-full",
        className,
      )}
    />
  );
}

function HeaderSkeleton({ layout }: { layout: TableColumnLayout }) {
  const skeleton = layout.headerSkeleton ?? layout.skeleton;

  switch (skeleton) {
    case "index":
      return <TextSkeleton className={layout.headerWidth ?? "w-3"} />;
    case "icon":
      return <Skeleton className="w-4 h-4 rounded" />;
    case "badge":
      return (
        <TextSkeleton className={layout.headerWidth ?? "w-14"} size="badge" />
      );
    case "action":
      return <Skeleton className="w-4 h-4 ml-auto mr-2 rounded" />;
    case "empty":
      return null;
    default:
      return <TextSkeleton className={layout.headerWidth ?? "w-16"} />;
  }
}

function MediaTitleSkeleton({ width }: { width?: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0 w-full">
      <Skeleton className="w-10 h-10 rounded" />
      <TextSkeleton className={width ?? "w-32 max-w-[70%]"} />
    </div>
  );
}

function RowSkeleton({ layout }: { layout: TableColumnLayout }) {
  switch (layout.skeleton) {
    case "index":
      return <Skeleton className="w-5 h-5 rounded" />;
    case "songTitle":
      return (
        <div className="flex items-center gap-2 min-w-0 w-full">
          <Skeleton className="w-10 h-10 rounded" />
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <TextSkeleton className="w-36 max-w-[70%]" />
            <TextSkeleton className="w-24 max-w-[50%]" size="xs" />
          </div>
        </div>
      );
    case "mediaTitle":
      return <MediaTitleSkeleton width={layout.rowWidth} />;
    case "icon":
      return <Skeleton className="w-5 h-5 rounded" />;
    case "badge":
      return (
        <TextSkeleton className={layout.rowWidth ?? "w-14"} size="badge" />
      );
    case "action":
      return <Skeleton className="w-5 h-5 ml-auto mr-2 rounded" />;
    case "empty":
      return null;
    default:
      return <TextSkeleton className={layout.rowWidth ?? "w-20"} />;
  }
}

export function TableFallback({
  variant = "classic",
  type = "regular",
  length = 10,
  columns = "songs",
  columnIds,
}: TableFallbackProps) {
  const hasHover = useHasHover();
  const isClassic = variant === "classic";
  const isModern = variant === "modern";
  const isRegular = type === "regular";
  const isList = type === "infinity";
  const layouts = getColumnLayouts({
    columnIds,
    hasHover,
    kind: columns,
  });

  return (
    <div
      className={cn(
        "w-full",
        isClassic && !isList && "rounded-md bg-background border",
        isModern && "bg-transparent",
      )}
    >
      <div
        className={cn(
          "w-full flex flex-row border-b",
          isList && "pr-[10px] bg-muted",
          isModern && !isList && "border-foreground/20",
          isModern && isRegular && "mb-2",
        )}
      >
        {layouts.map((layout) => (
          <FallbackCell
            key={layout.id}
            isHeader={true}
            isList={isList}
            layout={layout}
          >
            <HeaderSkeleton layout={layout} />
          </FallbackCell>
        ))}
      </div>
      <div className={cn(isModern && "rounded-md")}>
        {Array.from({ length }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "h-14 flex flex-row",
              isList ? "w-[calc(100%-10px)]" : "w-full",
              isClassic && !isList && "border-b last:border-b-0",
              isModern && "rounded-md",
            )}
          >
            {layouts.map((layout) => (
              <FallbackCell key={layout.id} layout={layout}>
                <RowSkeleton layout={layout} />
              </FallbackCell>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TopSongsTableFallback() {
  return (
    <div className="w-full mb-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="w-28 h-8 rounded" />
        <Skeleton className="w-16 h-5 rounded" />
      </div>

      <TableFallback variant="modern" columnIds={topSongsColumnIds} />
    </div>
  );
}
