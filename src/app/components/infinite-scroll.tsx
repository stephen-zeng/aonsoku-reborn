import { useEffect, useRef } from "react";

interface InfiniteScrollProps {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isLoading?: boolean;
}

export function InfiniteScroll({
  fetchNextPage,
  hasNextPage,
  isLoading,
}: InfiniteScrollProps) {
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = observerTarget.current;
    if (!target || !hasNextPage || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(target);

    return () => {
      observer.unobserve(target);
    };
  }, [fetchNextPage, hasNextPage, isLoading]);

  if (!hasNextPage) return null;

  return (
    <div
      ref={observerTarget}
      className="h-10 w-full flex items-center justify-center"
    >
      {isLoading && (
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      )}
    </div>
  );
}
