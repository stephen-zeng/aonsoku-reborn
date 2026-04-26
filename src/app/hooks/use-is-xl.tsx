import { useEffect, useState } from "react";

const XL_BREAKPOINT = 1024;

export function useIsXl() {
  const [isXl, setIsXl] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${XL_BREAKPOINT}px)`);
    const onChange = () => {
      setIsXl(window.innerWidth >= XL_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsXl(window.innerWidth >= XL_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isXl;
}
