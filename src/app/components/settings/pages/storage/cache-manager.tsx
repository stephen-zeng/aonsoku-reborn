import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, HardDrive, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Content,
  ContentSeparator,
  Header,
  HeaderDescription,
  HeaderTitle,
  Root,
} from "@/app/components/settings/section";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { ConfirmationDialog } from "@/app/components/ui/confirmation-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { SimpleTooltip } from "@/app/components/ui/simple-tooltip";
import {
  ScrollArea,
  scrollAreaViewportSelector,
} from "@/app/components/ui/scroll-area";
import {
  cacheManager,
  type CachedItemDetail,
} from "@/service/cache/cache-manager";
import { formatBytes } from "@/utils/formatBytes";
import dateTime from "@/utils/dateTime";

type CacheFilter = "all" | "audio" | "cover" | "explicit" | "smart" | "lru";

export function CacheManagerSection() {
  const { t } = useTranslation();
  const [items, setItems] = useState<CachedItemDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CacheFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<CachedItemDetail | null>(
    null,
  );

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await cacheManager.listCachedItems();
      setItems(data);
    } catch (err) {
      console.error("[CacheManager] failed to list items:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "audio") return items.filter((i) => i.type === "audio");
    if (filter === "cover") return items.filter((i) => i.type === "cover");
    return items.filter((i) => i.source === filter);
  }, [items, filter]);

  const totalSize = useMemo(
    () => filteredItems.reduce((sum, i) => sum + i.sizeBytes, 0),
    [filteredItems],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await cacheManager.evictItem(deleteTarget.key);
    setDeleteTarget(null);
    await loadItems();
  }, [deleteTarget, loadItems]);

  return (
    <Root>
      <Header className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-2">
          <HeaderTitle>{t("settings.storage.cacheManager.group")}</HeaderTitle>
          <HeaderDescription>
            {t("settings.storage.cacheManager.description")}
          </HeaderDescription>
        </div>
        <Select
          value={filter}
          onValueChange={(value) => setFilter(value as CacheFilter)}
          disabled={loading || items.length === 0}
        >
          <SelectTrigger className="h-8 ring-offset-transparent focus:ring-0 focus:ring-transparent text-left w-[140px]">
            <SelectValue>
              <span className="text-sm text-foreground">
                {t(`settings.storage.cacheManager.filter.${filter}`)}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              {(
                [
                  "all",
                  "audio",
                  "cover",
                  "explicit",
                  "smart",
                  "lru",
                ] as CacheFilter[]
              ).map((f) => (
                <SelectItem key={f} value={f}>
                  {t(`settings.storage.cacheManager.filter.${f}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Header>

      <Content>
        <CacheList
          items={filteredItems}
          loading={loading}
          onDelete={setDeleteTarget}
        />

        {!loading && filteredItems.length > 0 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            {t("settings.storage.cacheManager.list.total", {
              count: filteredItems.length,
              size: formatBytes(totalSize),
            })}
          </p>
        )}
      </Content>

      <ContentSeparator />

      <ConfirmationDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("settings.storage.cacheManager.confirmDelete.title")}
        description={t(
          "settings.storage.cacheManager.confirmDelete.description",
          { name: deleteTarget?.name ?? "" },
        )}
        onConfirm={handleDelete}
        cancelLabel={t("generic.cancel")}
        confirmLabel={t("settings.storage.cacheManager.list.delete")}
      />
    </Root>
  );
}

interface CacheListProps {
  items: CachedItemDetail[];
  loading: boolean;
  onDelete: (item: CachedItemDetail) => void;
}

function CacheList({ items, loading, onDelete }: CacheListProps) {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);

  const getScrollElement = useCallback(() => {
    if (!parentRef.current) return null;
    return parentRef.current.querySelector(scrollAreaViewportSelector);
  }, []);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement,
    estimateSize: () => 56,
    overscan: 5,
  });

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{t("generic.loading")}</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
        <HardDrive className="h-8 w-8 opacity-50" />
        <span className="text-sm">
          {t("settings.storage.cacheManager.list.empty")}
        </span>
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      {/* Header */}
      <div className="flex flex-row items-center border-b bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
        <div className="flex-1 min-w-0">
          {t("settings.storage.cacheManager.list.name")}
        </div>
        <div className="w-20 text-center hidden sm:block">
          {t("settings.storage.cacheManager.list.type")}
        </div>
        <div className="w-24 text-center hidden sm:block">
          {t("settings.storage.cacheManager.list.source")}
        </div>
        <div className="w-24 text-right hidden md:block">
          {t("settings.storage.cacheManager.list.size")}
        </div>
        <div className="w-28 text-right hidden lg:block">
          {t("settings.storage.cacheManager.list.cachedAt")}
        </div>
        <div className="w-14 text-center">
          {t("settings.storage.cacheManager.list.actions")}
        </div>
      </div>

      {/* Virtual list */}
      <ScrollArea
        ref={parentRef}
        type="always"
        className="h-[320px] overflow-auto"
      >
        <div
          className="w-full relative"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = items[virtualRow.index];
            return (
              <div
                key={item.key}
                className="absolute left-0 w-full flex flex-row items-center px-3 py-2 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5">
                    {item.removedFromServer && (
                      <SimpleTooltip
                        text={t(
                          "settings.storage.cacheManager.list.removedFromServer",
                        )}
                        delay={0}
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      </SimpleTooltip>
                    )}
                    <span className="text-sm font-medium truncate">
                      {item.name}
                    </span>
                  </div>
                  {item.subtitle && (
                    <span className="text-xs text-muted-foreground truncate">
                      {item.subtitle}
                    </span>
                  )}
                </div>

                <div className="w-20 text-center hidden sm:block">
                  <Badge
                    variant={item.type === "audio" ? "secondary" : "outline"}
                  >
                    {t(`settings.storage.cacheManager.list.type_${item.type}`)}
                  </Badge>
                </div>

                <div className="w-24 text-center hidden sm:block">
                  {item.type === "audio" ? (
                    <SourceBadge source={item.source} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>

                <div className="w-24 text-right hidden md:block">
                  <span className="text-sm text-muted-foreground">
                    {formatBytes(item.sizeBytes)}
                  </span>
                </div>

                <div className="w-28 text-right hidden lg:block">
                  <span className="text-xs text-muted-foreground">
                    {dateTime(item.cachedAt).fromNow()}
                  </span>
                </div>

                <div className="w-14 text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function SourceBadge({ source }: { source: CachedItemDetail["source"] }) {
  const className =
    source === "explicit"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-transparent"
      : source === "smart"
        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-transparent"
        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-transparent";

  return <Badge className={className}>{source}</Badge>;
}
