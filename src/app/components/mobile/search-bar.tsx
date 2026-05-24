import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { AlbumsFilters, AlbumsSearchParams } from "@/utils/albumsFilter";
import { SearchParamsHandler } from "@/utils/searchParamsHandler";

interface MobileSearchBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder: string;
}

export function MobileSearchBar({
  open,
  onOpenChange,
  placeholder,
}: MobileSearchBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { getSearchParam } = new SearchParamsHandler(searchParams);
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  const filter = getSearchParam<string>(AlbumsSearchParams.MainFilter, "");
  const query = getSearchParam<string>(AlbumsSearchParams.Query, "");

  const [inputValue, setInputValue] = useState(query);

  const debounced = useDebouncedCallback((value: string) => {
    applySearch(value);
  }, 500);

  function applySearch(value: string) {
    const trimmed = value.trim();
    if (trimmed) {
      setSearchParams(
        (params) => {
          params.set(AlbumsSearchParams.MainFilter, AlbumsFilters.Search);
          params.set(AlbumsSearchParams.Query, trimmed);
          return params;
        },
        { replace: true },
      );
    } else {
      clearSearch();
    }
  }

  function clearSearch() {
    setInputValue("");
    setSearchParams(
      (params) => {
        params.delete(AlbumsSearchParams.MainFilter);
        params.delete(AlbumsSearchParams.Query);
        return params;
      },
      { replace: true },
    );
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    if (filter === AlbumsFilters.Search && query) {
      setInputValue(query);
      onOpenChange(true);
    }
  }, [filter, query, onOpenChange]);

  return (
    <div
      className="grid transition-[grid-template-rows] duration-200 ease-in-out"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">
        <div className="pb-3">
          <div className="relative flex items-center">
            <SearchIcon className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              value={inputValue}
              placeholder={placeholder}
              className="pl-9 pr-9 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              onCompositionStart={() => {
                composingRef.current = true;
              }}
              onCompositionEnd={(e) => {
                composingRef.current = false;
                debounced(e.currentTarget.value);
              }}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (!composingRef.current) {
                  debounced(e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applySearch(inputRef.current?.value ?? "");
                  inputRef.current?.blur();
                }
              }}
            />
            {inputValue && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 size-9"
                onClick={clearSearch}
              >
                <XIcon className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
