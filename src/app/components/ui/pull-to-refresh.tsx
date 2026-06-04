import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useHaptic } from "@/app/hooks/use-haptic";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 70,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const haptic = useHaptic();

  const startYRef = useRef(0);
  const isAtTopRef = useRef(false);
  const isPullingRef = useRef(false);
  const hasTriggeredHapticRef = useRef(false);

  // SVG configuration
  const radius = 10;
  const strokeWidth = 2.5;
  const circumference = 2 * Math.PI * radius;

  // Transformations
  const progress = useTransform(y, [0, threshold], [0, 1]);
  const strokeDashoffset = useTransform(progress, [0, 1], [circumference, 0]);
  const pullRotate = useTransform(progress, [0, 1], [-90, 90]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return;

      const scrollY = window.scrollY || document.documentElement.scrollTop;
      isAtTopRef.current = scrollY <= 0;
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = false;
      hasTriggeredHapticRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshing || !isAtTopRef.current) return;

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startYRef.current;

      // Only pull down if deltaY is positive
      if (deltaY > 0) {
        if (e.cancelable) {
          e.preventDefault();
        }

        isPullingRef.current = true;

        // Apply logarithmic resistance
        const maxPull = 120;
        const pull = Math.min(maxPull, Math.pow(deltaY, 0.85) * 0.6);
        y.set(pull);

        // Haptic feedback when crossing threshold
        if (pull >= threshold && !hasTriggeredHapticRef.current) {
          hasTriggeredHapticRef.current = true;
          haptic.trigger?.("light");
        } else if (pull < threshold && hasTriggeredHapticRef.current) {
          hasTriggeredHapticRef.current = false;
        }
      }
    };

    const handleTouchEnd = async () => {
      if (isRefreshing || !isPullingRef.current) return;
      isPullingRef.current = false;

      const currentPull = y.get();
      if (currentPull >= threshold) {
        setIsRefreshing(true);
        await animate(y, threshold, {
          type: "spring",
          stiffness: 300,
          damping: 25,
        });

        try {
          await onRefresh();
        } catch (err) {
          console.error("[PullToRefresh] Refresh failed:", err);
        } finally {
          setIsRefreshing(false);
          await animate(y, 0, {
            type: "spring",
            stiffness: 300,
            damping: 30,
          });
        }
      } else {
        await animate(y, 0, {
          type: "spring",
          stiffness: 300,
          damping: 30,
        });
      }
    };

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, {
      passive: true,
    });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [isRefreshing, onRefresh, threshold, y, haptic]);

  return (
    <div ref={containerRef} className="relative w-full overflow-visible">
      {/* Spinner Container */}
      <div
        className="absolute left-0 right-0 flex justify-center items-center pointer-events-none"
        style={{
          height: threshold,
          top: 0,
          zIndex: 10,
        }}
      >
        <motion.div
          style={{
            opacity: useTransform(y, [0, threshold / 2], [0, 1]),
            scale: useTransform(y, [0, threshold], [0.8, 1]),
          }}
          className="w-10 h-10 rounded-full bg-background border shadow-md flex items-center justify-center"
        >
          <svg
            className={cn(
              "w-6 h-6 text-primary",
              isRefreshing && "animate-spin",
            )}
            viewBox="0 0 24 24"
          >
            <circle
              className="text-muted-foreground/10"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="transparent"
              r={radius}
              cx="12"
              cy="12"
            />
            <motion.circle
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={
                isRefreshing ? circumference * 0.25 : strokeDashoffset
              }
              strokeLinecap="round"
              fill="transparent"
              r={radius}
              cx="12"
              cy="12"
              style={{
                transformOrigin: "50% 50%",
                rotate: isRefreshing ? 0 : pullRotate,
              }}
            />
          </svg>
        </motion.div>
      </div>

      {/* Main Content Area */}
      <motion.div style={{ y }} className="w-full will-change-transform">
        {children}
      </motion.div>
    </div>
  );
}
