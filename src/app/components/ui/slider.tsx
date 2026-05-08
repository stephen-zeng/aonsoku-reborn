import * as SliderPrimitive from "@radix-ui/react-slider";
import { clsx } from "clsx";
import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

type Variant = "default" | "secondary";

type FullscreenContrast = {
  sliderTrackColor: string;
  sliderRangeColor: string;
  sliderThumbColor: string;
} | null;

type SliderProps = React.ComponentPropsWithoutRef<
  typeof SliderPrimitive.Root
> & {
  variant?: Variant;
  tooltipValue?: string;
  isBuffering?: boolean;
  bufferedProgress?: number;
  contrast?: FullscreenContrast;
};

type TouchState = {
  startX: number;
  startValue: number;
  currentValue: number;
  isDragging: boolean;
};

type RelativeTouchSliderOptions = {
  value: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
  disabled?: boolean;
};

const TAP_THRESHOLD = 5;

function useRelativeTouchSlider({
  value,
  defaultValue,
  min,
  max,
  step,
  onValueChange,
  onValueCommit,
  disabled,
}: RelativeTouchSliderOptions) {
  const touchState = React.useRef<TouchState | null>(null);
  const lastCommittedValue = React.useRef<number | null>(null);
  const callbacksRef = React.useRef({
    value,
    defaultValue,
    min,
    max,
    step,
    onValueChange,
    onValueCommit,
    disabled,
  });

  React.useEffect(() => {
    callbacksRef.current = {
      value,
      defaultValue,
      min,
      max,
      step,
      onValueChange,
      onValueCommit,
      disabled,
    };
  });

  const cleanupRef = React.useRef<(() => void) | null>(null);

  return React.useCallback((el: HTMLSpanElement | null) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (!el) return;

    const getCurrentValue = () => {
      const {
        value: val,
        defaultValue: defVal,
        min: rawMin,
      } = callbacksRef.current;
      if (val && val.length > 0) return val[0];
      if (lastCommittedValue.current !== null)
        return lastCommittedValue.current;
      return defVal?.[0] ?? rawMin ?? 0;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;

      const { disabled: isDisabled } = callbacksRef.current;
      if (isDisabled) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      touchState.current = {
        startX: e.clientX,
        startValue: getCurrentValue(),
        currentValue: getCurrentValue(),
        isDragging: false,
      };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (!touchState.current) return;

      const state = touchState.current;
      const deltaX = e.clientX - state.startX;

      if (Math.abs(deltaX) > TAP_THRESHOLD) {
        state.isDragging = true;
      }

      if (!state.isDragging) return;

      e.preventDefault();
      e.stopPropagation();

      const {
        min: rawMin,
        max: rawMax,
        step: rawStep,
        onValueChange: onChange,
      } = callbacksRef.current;

      const safeMin = rawMin ?? 0;
      const safeMax = rawMax ?? 100;
      const safeStep = rawStep ?? 1;

      const rect = el.getBoundingClientRect();
      const deltaRatio = deltaX / rect.width;
      const deltaValue = deltaRatio * (safeMax - safeMin);
      let newValue = state.startValue + deltaValue;
      newValue = Math.min(safeMax, Math.max(safeMin, newValue));
      newValue = Math.round(newValue / safeStep) * safeStep;

      if (newValue !== state.currentValue) {
        state.currentValue = newValue;
        onChange?.([newValue]);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (!touchState.current) return;

      const state = touchState.current;
      const { onValueCommit: onCommit } = callbacksRef.current;

      e.preventDefault();

      if (state.isDragging) {
        lastCommittedValue.current = state.currentValue;
        onCommit?.([state.currentValue]);
      }

      touchState.current = null;
    };

    el.addEventListener("pointerdown", handlePointerDown, {
      capture: true,
    });
    el.addEventListener("pointermove", handlePointerMove, {
      capture: true,
    });
    el.addEventListener("pointerup", handlePointerUp, {
      capture: true,
    });
    el.addEventListener("pointercancel", handlePointerUp, {
      capture: true,
    });

    cleanupRef.current = () => {
      el.removeEventListener("pointerdown", handlePointerDown, {
        capture: true,
      });
      el.removeEventListener("pointermove", handlePointerMove, {
        capture: true,
      });
      el.removeEventListener("pointerup", handlePointerUp, {
        capture: true,
      });
      el.removeEventListener("pointercancel", handlePointerUp, {
        capture: true,
      });
    };
  }, []);
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(
  (
    {
      className,
      tooltipValue,
      variant = "default",
      isBuffering = false,
      bufferedProgress = 0,
      contrast,
      ...props
    },
    ref,
  ) => {
    const bindTouchEvents = useRelativeTouchSlider({
      value: props.value ?? [],
      defaultValue: props.defaultValue,
      min: props.min,
      max: props.max,
      step: props.step,
      onValueChange: props.onValueChange,
      onValueCommit: props.onValueCommit,
      disabled: props.disabled,
    });

    const setRefs = React.useCallback(
      (node: HTMLSpanElement | null) => {
        bindTouchEvents(node);
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref, bindTouchEvents],
    );

    const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
    };

    const [showTooltip, setShowTooltip] = React.useState(false);

    const trackClass = clsx(
      "relative h-1 w-full grow overflow-hidden rounded-full select-none",
      !isBuffering && variant === "default" && "bg-secondary",
      isBuffering && "buffer-track",
      isBuffering && variant === "secondary" && "buffer-secondary",
      !isBuffering &&
        variant === "secondary" &&
        (contrast?.sliderTrackColor ?? "bg-muted-foreground/70"),
    );

    const rangeClass = clsx(
      "absolute h-full select-none rounded",
      variant === "default" && "bg-primary",
      variant === "secondary" &&
        (contrast?.sliderRangeColor ?? "bg-secondary-foreground"),
    );

    const thumbClass = clsx(
      "block opacity-0 h-4 w-4 sm:h-3 sm:w-3 cursor-pointer select-none rounded-full",
      "border-2 ring-offset-background transition-[background-color,opacity]",
      "focus-visible:outline-none focus-visible:ring-transparent",
      "disabled:pointer-events-none disabled:opacity-50 transform-gpu",
      showTooltip && "opacity-100",
      variant === "default" && "bg-foreground border-foreground",
      variant === "secondary" &&
        (contrast?.sliderThumbColor ??
          "bg-secondary-foreground border-secondary-foreground"),
    );

    return (
      <SliderPrimitive.Root
        ref={setRefs}
        aria-busy={isBuffering || undefined}
        className={cn(
          "relative h-3 flex w-full touch-none select-none items-center cursor-pointer",
          className,
        )}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        {...props}
      >
        <SliderPrimitive.Track
          className={trackClass}
          onContextMenu={handleContextMenu}
        >
          <BufferedProgressIndicator
            bufferedProgress={bufferedProgress}
            max={props.max ?? 100}
          />
          <SliderPrimitive.Range
            className={rangeClass}
            onContextMenu={handleContextMenu}
          />
        </SliderPrimitive.Track>

        <SliderTooltip
          open={showTooltip && tooltipValue !== undefined}
          variant={variant}
          value={tooltipValue ?? ""}
          align="center"
        >
          <SliderPrimitive.Thumb
            className={thumbClass}
            onKeyDown={(e) => e.preventDefault()}
          />
        </SliderTooltip>
      </SliderPrimitive.Root>
    );
  },
);
Slider.displayName = SliderPrimitive.Root.displayName;

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
      className="absolute h-full bg-muted-foreground/30 rounded"
      style={{ width: `${percentage}%` }}
      aria-hidden="true"
      data-buffered-progress
    />
  );
}

export { Slider };

type SliderTooltipProps = React.ComponentPropsWithoutRef<
  typeof TooltipContent
> & {
  open: boolean;
  value: string;
  variant: Variant;
  position?: number;
};

function SliderTooltip({
  open,
  value,
  variant,
  children,
  position,
  ...props
}: SliderTooltipProps) {
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const alignOffset = React.useMemo(() => {
    if (!position || !contentRef.current) return undefined;

    const contentWidth = contentRef.current.getBoundingClientRect().width;
    return position - contentWidth / 2;
  }, [position]);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={open}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          ref={contentRef}
          className={clsx(
            "px-2 py-1",
            variant === "default" && "bg-background",
            variant === "secondary" &&
              "bg-secondary-foreground border-muted-foreground/50 text-secondary font-semibold text-base",
          )}
          sticky="always"
          hideWhenDetached={true}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          style={{ cursor: "default" }}
          alignOffset={alignOffset}
          {...props}
        >
          <p>{value}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type ProgressSliderProps = React.ComponentPropsWithoutRef<
  typeof SliderPrimitive.Root
> & {
  variant?: Variant;
  tooltipValue?: string;
  tooltipTransformer?: (value: number) => string;
  isBuffering?: boolean;
  bufferedProgress?: number;
  contrast?: FullscreenContrast;
};

export function ProgressSlider(props: ProgressSliderProps) {
  const {
    className,
    tooltipValue,
    tooltipTransformer,
    variant = "default",
    isBuffering = false,
    bufferedProgress = 0,
    onValueChange,
    contrast,
    ...rest
  } = props;

  const sliderRef = React.useRef<HTMLSpanElement | null>(null);
  const frameId = React.useRef<number | null>(null);

  const [showTooltip, setShowTooltip] = React.useState(false);
  const [tooltipComputedValue, setTooltipComputedValue] = React.useState(0);
  const [cursorPosition, setCursorPosition] = React.useState(0);

  const maxValue = props.max ?? 0;

  const enableTooltip = React.useMemo(() => {
    const hasAnyTooltipProps =
      tooltipValue !== undefined || tooltipTransformer !== undefined;

    return showTooltip && hasAnyTooltipProps;
  }, [showTooltip, tooltipTransformer, tooltipValue]);

  const formattedTooltipValue = React.useMemo(() => {
    if (typeof tooltipTransformer === "undefined" && tooltipValue) {
      return tooltipValue;
    }

    if (tooltipTransformer) {
      return tooltipTransformer(tooltipComputedValue);
    }

    return "";
  }, [tooltipComputedValue, tooltipTransformer, tooltipValue]);

  const updateTooltip = (mouseX: number, width: number) => {
    const rawTime = (mouseX / width) * maxValue;
    const time = Math.max(0, Math.round(rawTime));

    const position = Math.max(0, Math.round(mouseX)) + 1;
    setCursorPosition(position);
    setTooltipComputedValue(time);

    frameId.current = null;
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!sliderRef.current) return;

    const sliderRect = sliderRef.current.getBoundingClientRect();
    const mouseX = event.clientX - sliderRect.left;
    const sliderWidth = sliderRect.width;

    if (!frameId.current) {
      frameId.current = requestAnimationFrame(() =>
        updateTooltip(mouseX, sliderWidth),
      );
    }
  };

  const computeBoundaries = (mouseX: number, mouseY: number) => {
    if (!sliderRef.current) return undefined;

    const sliderRect = sliderRef.current.getBoundingClientRect();
    const { right, left, top, bottom } = {
      left: sliderRect.left - 2,
      right: sliderRect.right,
      top: sliderRect.top - 1.5,
      bottom: sliderRect.bottom + 1,
    };

    const xLimits = mouseX >= left && mouseX <= right;
    const yLimits = mouseY >= top && mouseY <= bottom;
    const isInside = xLimits && yLimits;

    return {
      isInside,
      left,
      right,
      top,
      bottom,
      width: sliderRect.width,
    };
  };

  const handleMouseOver = (event: React.MouseEvent<HTMLDivElement>) => {
    const [mouseX, mouseY] = [event.clientX, event.clientY];

    const bounds = computeBoundaries(mouseX, mouseY);
    if (!bounds) return;

    const { isInside, left, width } = bounds;

    if (isInside) {
      if (!frameId.current) {
        frameId.current = requestAnimationFrame(() =>
          updateTooltip(mouseX - left, width),
        );
      }

      setShowTooltip(true);
    }
  };

  const computeCurrentValuePosition = (value: number) => {
    if (!sliderRef.current) return;

    const { width } = sliderRef.current.getBoundingClientRect();

    const percentage = (value / maxValue) * 100;
    const mousePosition = (percentage / 100) * width;
    const positionWithLimits = Math.max(0, mousePosition) + 1;

    setCursorPosition(positionWithLimits);
  };

  const handleValueChange = (value: number) => {
    if (onValueChange) onValueChange([value]);
    setTooltipComputedValue(value);
    computeCurrentValuePosition(value);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const bindTouchEvents = useRelativeTouchSlider({
    value: props.value ?? [],
    defaultValue: props.defaultValue,
    min: props.min,
    max: props.max,
    step: props.step,
    onValueChange: ([v]) => handleValueChange(v),
    onValueCommit: rest.onValueCommit,
    disabled: props.disabled,
  });

  const setRefs = React.useCallback(
    (node: HTMLSpanElement | null) => {
      bindTouchEvents(node);
      sliderRef.current = node;
    },
    [bindTouchEvents],
  );

  return (
    <SliderPrimitive.Root
      ref={setRefs}
      aria-busy={isBuffering || undefined}
      className={cn(
        "relative h-3 flex w-full touch-none select-none items-center cursor-pointer",
        className,
      )}
      onMouseOver={handleMouseOver}
      onMouseOut={() => setShowTooltip(false)}
      onMouseMove={handleMouseMove}
      onValueChange={([value]) => handleValueChange(value)}
      {...rest}
    >
      <SliderTooltip
        open={enableTooltip}
        variant={variant}
        value={formattedTooltipValue}
        position={cursorPosition}
        align="start"
        sideOffset={8}
      >
        <SliderPrimitive.Track
          className={clsx(
            "relative h-1 w-full grow overflow-hidden rounded-full select-none",
            !isBuffering && variant === "default" && "bg-secondary",
            isBuffering && "buffer-track",
            isBuffering && variant === "secondary" && "buffer-secondary",
            !isBuffering &&
              variant === "secondary" &&
              (contrast?.sliderTrackColor ?? "bg-muted-foreground/70"),
          )}
          onContextMenu={handleContextMenu}
        >
          <BufferedProgressIndicator
            bufferedProgress={bufferedProgress}
            max={maxValue}
          />
          <SliderPrimitive.Range
            className={clsx(
              "absolute h-full select-none transition-[border-radius]",
              variant === "default" && "bg-primary",
              variant === "secondary" &&
                (contrast?.sliderRangeColor ?? "bg-secondary-foreground"),
              showTooltip ? "rounded-none" : "rounded",
            )}
            onContextMenu={handleContextMenu}
          />
        </SliderPrimitive.Track>
      </SliderTooltip>

      <SliderPrimitive.Thumb
        className={clsx(
          "block opacity-0 h-4 w-4 sm:h-3 sm:w-3 cursor-pointer select-none rounded-full",
          "border-2 transition-[background-color,opacity]",
          "focus-visible:outline-none focus-visible:ring-transparent",
          "disabled:pointer-events-none disabled:opacity-50 transform-gpu",
          showTooltip && "opacity-100",
          variant === "default" && "bg-foreground border-foreground",
          variant === "secondary" &&
            (contrast?.sliderThumbColor ??
              "bg-secondary-foreground border-secondary-foreground"),
        )}
        onKeyDown={(e) => e.preventDefault()}
      />
    </SliderPrimitive.Root>
  );
}
