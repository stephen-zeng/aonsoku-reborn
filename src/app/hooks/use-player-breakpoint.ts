import { useEffect, useState } from "react";

export function usePlayerBreakpoint(breakpoint = 640) {
  const [isBelow, setIsBelow] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsBelow(event.matches);
    };

    onChange(mql);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isBelow;
}
