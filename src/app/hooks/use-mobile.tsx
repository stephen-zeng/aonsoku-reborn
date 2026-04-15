import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;
const SHORT_VIEWPORT_HEIGHT = 700;

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    mql.addEventListener("change", onChange);
    setMatches(mql.matches);

    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return !!matches;
}

export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}

export function useIsShortViewport() {
  return useMediaQuery(`(max-height: ${SHORT_VIEWPORT_HEIGHT}px)`);
}
