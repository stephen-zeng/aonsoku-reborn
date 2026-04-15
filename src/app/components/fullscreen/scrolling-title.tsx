import { motion, useAnimationControls } from "framer-motion";
import {
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

interface ScrollingTitleProps {
  children: ReactNode;
}

const SCROLL_SPEED = 30;
const INITIAL_DELAY = 2;
const PAUSE_DURATION = 3;
const EDGE_EASE_DURATION = 0.35;
const TEXT_GAP = 80;
const FADE_WIDTH = 20;
const MIN_LINEAR_DISTANCE = 1;

const MASK_STYLE = {
  left: -FADE_WIDTH,
  right: 0,
  maskImage: `linear-gradient(90deg, transparent 0px, rgb(0, 0, 0) ${FADE_WIDTH}px, rgb(0, 0, 0) calc(100% - ${FADE_WIDTH}px), transparent 100%)`,
} as const;

function createScrollAnimation(scrollDistance: number) {
  const duration = scrollDistance / SCROLL_SPEED;
  const edgeDuration = Math.min(EDGE_EASE_DURATION, duration / 2);
  const edgeDistance = Math.min(
    SCROLL_SPEED * edgeDuration,
    scrollDistance / 2,
  );
  const linearDistance = scrollDistance - edgeDistance * 2;

  if (linearDistance <= MIN_LINEAR_DISTANCE) {
    return {
      x: [0, -scrollDistance / 2, -scrollDistance],
      transition: {
        duration,
        times: [0, 0.5, 1],
        ease: ["easeOut", "easeIn"],
      } as const,
    };
  }

  return {
    x: [0, -edgeDistance, -(scrollDistance - edgeDistance), -scrollDistance],
    transition: {
      duration,
      times: [0, edgeDuration / duration, 1 - edgeDuration / duration, 1],
      ease: ["easeOut", "linear", "easeIn"],
    } as const,
  };
}

export function ScrollingTitle({ children }: ScrollingTitleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const [overflow, setOverflow] = useState({
    width: 0,
    height: 0,
    isOverflowing: false,
  });

  const calculateOverflow = useCallback(() => {
    if (!containerRef.current || !textRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const measuredWidth = textRef.current.scrollWidth;
    const measuredHeight = textRef.current.offsetHeight;
    const isOverflowing = measuredWidth > containerWidth;

    setOverflow((prev) =>
      prev.width === measuredWidth &&
      prev.height === measuredHeight &&
      prev.isOverflowing === isOverflowing
        ? prev
        : {
            width: measuredWidth,
            height: measuredHeight,
            isOverflowing,
          },
    );
  }, []);

  useLayoutEffect(() => {
    let rafId: number;
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(calculateOverflow);
    };

    calculateOverflow();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(rafId);
    };
  }, [calculateOverflow]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: need children to reset animation on content change
  useEffect(() => {
    controls.set({ x: 0 });
    setOverflow({ width: 0, height: 0, isOverflowing: false });
    calculateOverflow();
  }, [children, controls, calculateOverflow]);

  useEffect(() => {
    if (!overflow.isOverflowing || overflow.width <= 0) return;

    const scrollDistance = overflow.width + TEXT_GAP;
    const animation = createScrollAnimation(scrollDistance);
    let isCancelled = false;
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];

    async function runAnimation() {
      await new Promise<void>((resolve) => {
        timeoutIds.push(setTimeout(resolve, INITIAL_DELAY * 1000));
      });

      while (!isCancelled) {
        await controls.start({
          x: animation.x,
          transition: animation.transition,
        });

        if (isCancelled) break;

        controls.set({ x: 0 });

        await new Promise<void>((resolve) => {
          timeoutIds.push(setTimeout(resolve, PAUSE_DURATION * 1000));
        });
      }
    }

    runAnimation();

    return () => {
      isCancelled = true;
      timeoutIds.forEach(clearTimeout);
      controls.stop();
    };
  }, [overflow.isOverflowing, overflow.width, controls]);

  if (!overflow.isOverflowing) {
    return (
      <div
        ref={containerRef}
        className="w-full min-w-0 overflow-hidden"
        data-testid="scrolling-title"
      >
        <div ref={textRef} className="inline-block whitespace-nowrap">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full min-w-0 overflow-hidden"
      style={{
        minHeight: overflow.height > 0 ? `${overflow.height}px` : undefined,
      }}
      data-testid="scrolling-title"
    >
      <div
        className="absolute inset-y-0 overflow-hidden"
        style={MASK_STYLE}
        aria-hidden
      >
        <motion.div
          animate={controls}
          className="inline-flex whitespace-nowrap"
          style={{ marginLeft: FADE_WIDTH }}
        >
          <div ref={textRef}>{children}</div>
          <div style={{ paddingLeft: TEXT_GAP }} aria-hidden>
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
