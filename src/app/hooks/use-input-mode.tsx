import { useEffect, useState } from "react";

function useMatchMedia(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    mql.addEventListener("change", onChange);
    setMatches(mql.matches);

    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function useHasHover() {
  return useMatchMedia("(hover: hover)");
}

export function useIsTouchPrimary() {
  return useMatchMedia("(pointer: coarse)");
}
