import { CheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/app/components/ui/drawer";
import { SongsOrderByOptions, SortOptions } from "@/utils/albumsFilter";
import { SearchParamsHandler } from "@/utils/searchParamsHandler";

interface MobileSortDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSortDrawer({
  open,
  onOpenChange,
}: MobileSortDrawerProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getSearchParam } = new SearchParamsHandler(searchParams);

  const currentSort = getSearchParam<SortOptions>("sort", SortOptions.Desc);
  const currentOrderBy = getSearchParam<SongsOrderByOptions>(
    "orderBy",
    SongsOrderByOptions.LastAdded,
  );

  function handleChangeSort(value: SortOptions) {
    setSearchParams(
      (state) => {
        state.set("sort", value);
        return state;
      },
      { replace: true },
    );
  }

  function handleChangeOrderBy(value: SongsOrderByOptions) {
    setSearchParams(
      (state) => {
        state.set("orderBy", value);
        return state;
      },
      { replace: true },
    );
  }

  const orderByOptions = [
    { label: "songs.sort.lastAdded", value: SongsOrderByOptions.LastAdded },
    { label: "songs.sort.artist", value: SongsOrderByOptions.Artist },
    { label: "songs.sort.title", value: SongsOrderByOptions.Title },
    { label: "songs.sort.album", value: SongsOrderByOptions.Album },
  ];

  const sortOptions = [
    { label: "table.sort.desc", value: SortOptions.Desc },
    { label: "table.sort.asc", value: SortOptions.Asc },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t("songs.sort.title")}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-4">
          <div className="space-y-1">
            {orderByOptions.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm active:bg-accent/50"
                onClick={() => handleChangeOrderBy(value)}
              >
                <span>{t(label)}</span>
                {currentOrderBy === value && (
                  <CheckIcon className="size-4 text-primary" />
                )}
              </button>
            ))}
          </div>
          <div className="h-px bg-border" />
          <div className="space-y-1">
            {sortOptions.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm active:bg-accent/50"
                onClick={() => handleChangeSort(value)}
              >
                <span>{t(label)}</span>
                {currentSort === value && (
                  <CheckIcon className="size-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
