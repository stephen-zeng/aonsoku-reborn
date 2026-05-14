import { clsx } from "clsx";
import * as React from "react";

import { cn } from "@/lib/utils";

type Variant = "default" | "secondary";

type FullscreenContrast = {
  sliderTrackColor: string;
  sliderRangeColor: string;
  sliderThumbColor: string;
} | null;

type SliderBaseProps = {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
  disabled?: boolean;
  variant?: Variant;
  isBuffering?: boolean;
  bufferedProgress?: number;
  contrast?: FullscreenContrast;
  hideThumb?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

type DragState = {
  pointerId: number;
  startX: number;
  startValue: number;
  currentValue: number;
  isDragging: boolean;
};

const TAP_THRESHOLD = 5;

function useSlider({
  value: controlledValue,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  onValueCommit,
  disabled,
  onTouchStateChange,
}: {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
  disabled?: boolean;
  onTouchStateChange?: (isTouching: boolean) => void;
}) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = React.useState(() => {
    if (defaultValue && defaultValue.length > 0) return defaultValue[0];
    return min;
  });

  const currentValue =
    isControlled && controlledValue.length > 0
      ? controlledValue[0]
      : internalValue;

  const trackRef = React.useRef<HTMLDivElement>(null);
  const dragStateRef = React.useRef<DragState | null>(null);
  const currentValueRef = React.useRef(currentValue);
  currentValueRef.current = currentValue;

  React.useEffect(() => {
    return () => {
      if (dragStateRef.current) {
        onTouchStateChange?.(false);
        dragStateRef.current = null;
      }
    };
  }, [onTouchStateChange]);

  const safeStep = step || 1;
  const range = max - min;

  const computeValue = React.useCallback(
    (clientX: number) => {
      if (!trackRef.current) return min;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width === 0) return min;
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      const raw = min + ratio * (max - min);
      const clamped = Math.min(max, Math.max(min, raw));
      const stepped = Math.round(clamped / safeStep) * safeStep;
      return Number.isFinite(stepped) ? stepped : min;
    },
    [min, max, safeStep],
  );

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (dragStateRef.current) return;

      const isTouch = e.pointerType === "touch";

      if (isTouch) {
        e.preventDefault();
        onTouchStateChange?.(true);

        const val = currentValueRef.current;
        dragStateRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startValue: val,
          currentValue: val,
          isDragging: false,
        };
      } else {
        const newValue = computeValue(e.clientX);
        if (!isControlled) setInternalValue(newValue);
        onValueChange?.([newValue]);

        dragStateRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startValue: newValue,
          currentValue: newValue,
          isDragging: true,
        };
      }

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [disabled, isControlled, computeValue, onValueChange, onTouchStateChange],
  );

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== e.pointerId) return;

      if (e.pointerType === "touch") {
        const deltaX = Math.abs(e.clientX - state.startX);
        if (deltaX > TAP_THRESHOLD) {
          state.isDragging = true;
        }
        if (!state.isDragging) return;
        e.preventDefault();

        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        if (rect.width === 0) return;
        const deltaRatio = (e.clientX - state.startX) / rect.width;
        const deltaValue = deltaRatio * range;
        let newValue = state.startValue + deltaValue;
        newValue = Math.min(max, Math.max(min, newValue));
        newValue = Math.round(newValue / safeStep) * safeStep;
        if (!Number.isFinite(newValue)) newValue = min;

        if (newValue !== state.currentValue) {
          state.currentValue = newValue;
          if (!isControlled) setInternalValue(newValue);
          onValueChange?.([newValue]);
        }
        return;
      }

      const newValue = computeValue(e.clientX);
      if (newValue !== state.currentValue) {
        state.currentValue = newValue;
        if (!isControlled) setInternalValue(newValue);
        onValueChange?.([newValue]);
      }
    },
    [isControlled, min, max, range, safeStep, computeValue, onValueChange],
  );

  const finishDrag = React.useCallback(
    (pointerType: string, commitValue: number, isTap: boolean) => {
      try {
        if (isTap) {
          if (!isControlled) setInternalValue(commitValue);
          onValueChange?.([commitValue]);
        }
        onValueCommit?.([commitValue]);

        if (pointerType === "touch") {
          onTouchStateChange?.(false);
        }
      } finally {
        dragStateRef.current = null;
      }
    },
    [isControlled, onValueChange, onValueCommit, onTouchStateChange],
  );

  const commitAndCleanup = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== e.pointerId) return;

      const isTap = e.pointerType === "touch" && !state.isDragging;
      const commitValue = isTap ? computeValue(e.clientX) : state.currentValue;
      finishDrag(e.pointerType, commitValue, isTap);
    },
    [computeValue, finishDrag],
  );

  const handleLostPointerCapture = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== e.pointerId) return;

      const isTap = e.pointerType === "touch" && !state.isDragging;
      const commitValue = isTap ? computeValue(e.clientX) : state.currentValue;
      finishDrag(e.pointerType, commitValue, isTap);
    },
    [computeValue, finishDrag],
  );

  const percentage = range === 0 ? 0 : ((currentValue - min) / range) * 100;

  return {
    trackRef,
    currentValue,
    percentage,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: commitAndCleanup,
    handlePointerCancel: commitAndCleanup,
    handleLostPointerCapture,
  };
}

const Slider = React.forwardRef<HTMLDivElement, SliderBaseProps>(
  (
    {
      className,
      variant = "default",
      isBuffering = false,
      bufferedProgress = 0,
      contrast,
      hideThumb,
      value,
      defaultValue,
      min,
      max,
      step,
      onValueChange,
      onValueCommit,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [isTouching, setIsTouching] = React.useState(false);

    const {
      trackRef,
      percentage,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handlePointerCancel,
      handleLostPointerCapture,
    } = useSlider({
      value,
      defaultValue,
      min,
      max,
      step,
      onValueChange,
      onValueCommit,
      disabled,
      onTouchStateChange: setIsTouching,
    });

    return (
      <div
        ref={ref}
        aria-busy={isBuffering || undefined}
        className={cn(
          "group relative h-3 flex w-full touch-none select-none items-center cursor-pointer",
          className,
        )}
        {...props}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
      >
        <div
          ref={trackRef}
          className={clsx(
            "relative w-full grow overflow-hidden rounded-full select-none transition-[height] duration-150 ease-out",
            isTouching ? "h-[10px]" : "h-1",
            !isBuffering && variant === "default" && "bg-secondary",
            isBuffering && "buffer-track",
            isBuffering && variant === "secondary" && "buffer-secondary",
            !isBuffering &&
              variant === "secondary" &&
              (contrast?.sliderTrackColor ?? "bg-muted-foreground/70"),
          )}
          onContextMenu={(e) => e.preventDefault()}
        >
          <BufferedProgressIndicator
            bufferedProgress={bufferedProgress}
            max={max ?? 100}
          />
          <div
            className={clsx(
              "absolute h-full select-none rounded-full",
              variant === "default" && "bg-primary",
              variant === "secondary" &&
                (contrast?.sliderRangeColor ?? "bg-secondary-foreground"),
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div
          className={clsx(
            "absolute top-1/2 h-4 w-4 sm:h-3 sm:w-3 cursor-pointer select-none rounded-full border-2 shadow-md",
            "ring-offset-background transition-[background-color,opacity]",
            "focus-visible:outline-none focus-visible:ring-transparent",
            "disabled:pointer-events-none disabled:opacity-50 transform-gpu",
            hideThumb
              ? "opacity-0"
              : "opacity-0 group-hover-supported:opacity-100 slider-thumb",
            variant === "default" && "bg-foreground border-foreground",
            variant === "secondary" &&
              (contrast?.sliderThumbColor ??
                "bg-secondary-foreground border-secondary-foreground"),
          )}
          style={{
            left: `${percentage}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
    );
  },
);
Slider.displayName = "Slider";

function BufferedProgressIndicator({
  bufferedProgress,
  max,
}: {
  bufferedProgress: number;
  max: number;
}) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const percentage = Math.min((bufferedProgress / safeMax) * 100, 100);

  return (
    <div
      className="absolute h-full bg-muted-foreground/30 rounded-full"
      style={{ width: `${percentage}%` }}
      aria-hidden="true"
      data-buffered-progress
    />
  );
}

export { Slider };

export function ProgressSlider(props: SliderBaseProps) {
  return <Slider {...props} />;
}
