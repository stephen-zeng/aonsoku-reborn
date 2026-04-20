import { clsx } from "clsx";
import { ReactNode, useEffect, useRef, useState } from "react";
import Marquee from "react-fast-marquee";
import { useTextOverflow } from "@/app/hooks/use-text-overflow";

interface MarqueeTitleProps {
  children: ReactNode;
  gap: string;
}

export function MarqueeTitle({ children, gap }: MarqueeTitleProps) {
  const { containerRef, textRef, overflow, calculateOverflow } =
    useTextOverflow();
  const [isFinished, setIsFinished] = useState(false);
  const [marqueeKey, setMarqueeKey] = useState("");
  const isOverflowing = overflow.isOverflowing;
  const prevOverflowingRef = useRef(isOverflowing);

  useEffect(() => {
    if (isOverflowing) {
      prevOverflowingRef.current = true;
      return;
    }
    if (prevOverflowingRef.current) {
      setIsFinished(false);
      setMarqueeKey(`reset-${Date.now()}`);
    }
    prevOverflowingRef.current = false;
  }, [isOverflowing]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: needed to reset on content change
  useEffect(() => {
    setIsFinished(false);
    setMarqueeKey(`marquee-${Date.now()}`);
    calculateOverflow();
  }, [calculateOverflow, children]);

  return (
    <div className="relative">
      {/* Not shown in screen, its just for calculations */}
      <div
        className="w-full overflow-hidden whitespace-nowrap opacity-0 absolute left-0 right-0 bottom-0 pointer-events-none"
        ref={containerRef}
      >
        <div className="inline-flex" ref={textRef}>
          {children}
        </div>
      </div>

      <div>
        <Marquee
          key={marqueeKey}
          className={clsx(
            isOverflowing && !isFinished && "maskImage-marquee-fade",
            isFinished && "maskImage-marquee-fade-finished",
          )}
          speed={30}
          play={isOverflowing}
          loop={2}
          delay={3}
          pauseOnHover={true}
          onFinish={() => {
            setIsFinished(true);
          }}
        >
          <div className={gap}>{children}</div>
        </Marquee>
      </div>
    </div>
  );
}
