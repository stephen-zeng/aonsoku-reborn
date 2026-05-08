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
} & React.HTMLAttributes<HTMLDivElement>;

type TouchState = {
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

	const setSliderValue = React.useCallback(
		(rawValue: number) => {
			const clamped = Math.min(max, Math.max(min, rawValue));
			const stepped = Math.round(clamped / step) * step;
			if (!isControlled) setInternalValue(stepped);
			onValueChange?.([stepped]);
			return stepped;
		},
		[min, max, step, isControlled, onValueChange],
	);

	const commitSliderValue = React.useCallback(
		(val: number) => {
			onValueCommit?.([val]);
		},
		[onValueCommit],
	);

	const trackRef = React.useRef<HTMLDivElement>(null);
	const [isMouseDragging, setIsMouseDragging] = React.useState(false);

	const handleMouseDown = React.useCallback(
		(e: React.MouseEvent & MouseEvent) => {
			if (disabled || !trackRef.current) return;

			const rect = trackRef.current.getBoundingClientRect();
			const ratio = (e.clientX - rect.left) / rect.width;
			const newValue = min + ratio * (max - min);
			const finalValue = setSliderValue(newValue);
			setIsMouseDragging(true);

			const handleMouseMove = (e: MouseEvent) => {
				const ratio = (e.clientX - rect.left) / rect.width;
				const newValue = min + ratio * (max - min);
				setSliderValue(newValue);
			};

			const handleMouseUp = () => {
				setIsMouseDragging(false);
				commitSliderValue(finalValue);
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		},
		[disabled, min, max, setSliderValue, commitSliderValue],
	);

	const touchStateRef = React.useRef<TouchState | null>(null);
	const lastCommittedValueRef = React.useRef<number | null>(null);
	const callbacksRef = React.useRef({
		value: controlledValue,
		defaultValue,
		min,
		max,
		step,
		onValueChange,
		onValueCommit,
		disabled,
		onTouchStateChange,
	});

	React.useEffect(() => {
		callbacksRef.current = {
			value: controlledValue,
			defaultValue,
			min,
			max,
			step,
			onValueChange,
			onValueCommit,
			disabled,
			onTouchStateChange,
		};
	});

	const bindTouchEvents = React.useCallback((el: HTMLElement | null) => {
		if (!el) return;

		const getCurrentValue = () => {
			const {
				value: val,
				defaultValue: defVal,
				min: rawMin,
			} = callbacksRef.current;
			if (val && val.length > 0) return val[0];
			if (lastCommittedValueRef.current !== null)
				return lastCommittedValueRef.current;
			return defVal?.[0] ?? rawMin ?? 0;
		};

		const handlePointerDown = (e: PointerEvent) => {
			if (e.pointerType !== "touch") return;
			const { disabled: isDisabled } = callbacksRef.current;
			if (isDisabled) return;

			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();

			touchStateRef.current = {
				startX: e.clientX,
				startValue: getCurrentValue(),
				currentValue: getCurrentValue(),
				isDragging: false,
			};

			callbacksRef.current.onTouchStateChange?.(true);
		};

		const handlePointerMove = (e: PointerEvent) => {
			if (e.pointerType !== "touch") return;
			if (!touchStateRef.current) return;

			const state = touchStateRef.current;
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
			if (!touchStateRef.current) return;

			const state = touchStateRef.current;
			const { onValueCommit: onCommit } = callbacksRef.current;

			e.preventDefault();

			if (state.isDragging) {
				lastCommittedValueRef.current = state.currentValue;
				onCommit?.([state.currentValue]);
			}

			touchStateRef.current = null;
			callbacksRef.current.onTouchStateChange?.(false);
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

		return () => {
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

	const percentage = ((currentValue - min) / (max - min)) * 100;

	return {
		trackRef,
		currentValue,
		percentage,
		isMouseDragging,
		handleMouseDown,
		bindTouchEvents,
		setSliderValue,
		commitSliderValue,
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

		const { trackRef, percentage, handleMouseDown, bindTouchEvents } =
			useSlider({
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

		const rootRef = React.useRef<HTMLDivElement>(null);

		const setRefs = React.useCallback(
			(node: HTMLDivElement | null) => {
				rootRef.current = node;
				bindTouchEvents(node);
				if (typeof ref === "function") {
					ref(node);
				} else if (ref) {
					ref.current = node;
				}
			},
			[ref, bindTouchEvents],
		);

		return (
			<div
				ref={setRefs}
				aria-busy={isBuffering || undefined}
				className={cn(
					"group relative h-3 flex w-full touch-none select-none items-center cursor-pointer",
					className,
				)}
				onMouseDown={handleMouseDown}
				{...props}
			>
				<div
					ref={trackRef}
					className={clsx(
						"relative h-1 w-full grow overflow-hidden rounded-full select-none transition-transform duration-150 ease-out origin-center",
						isTouching && "scale-y-[2.5]",
						!isBuffering && variant === "default" && "bg-secondary",
						isBuffering && "buffer-track",
						isBuffering &&
							variant === "secondary" &&
							"buffer-secondary",
						!isBuffering &&
							variant === "secondary" &&
							(contrast?.sliderTrackColor ??
								"bg-muted-foreground/70"),
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
								(contrast?.sliderRangeColor ??
									"bg-secondary-foreground"),
						)}
						style={{ width: `${percentage}%` }}
					/>
				</div>

				<div
					className={clsx(
						"absolute top-1/2 h-4 w-4 sm:h-3 sm:w-3 cursor-pointer select-none rounded-full border-2",
						"ring-offset-background transition-[background-color,opacity]",
						"focus-visible:outline-none focus-visible:ring-transparent",
						"disabled:pointer-events-none disabled:opacity-50 transform-gpu",
						"opacity-0 group-hover:opacity-100",
						variant === "default" &&
							"bg-foreground border-foreground",
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
	const {
		className,
		variant = "default",
		isBuffering = false,
		bufferedProgress = 0,
		contrast,
		value,
		defaultValue,
		min,
		max,
		step,
		onValueChange,
		onValueCommit,
		disabled,
		...rest
	} = props;

	const [isTouching, setIsTouching] = React.useState(false);

	const { trackRef, percentage, handleMouseDown, bindTouchEvents } =
		useSlider({
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

	const setRefs = React.useCallback(
		(node: HTMLDivElement | null) => {
			bindTouchEvents(node);
		},
		[bindTouchEvents],
	);

	return (
		<div
			ref={setRefs}
			aria-busy={isBuffering || undefined}
			className={cn(
				"group relative h-3 flex w-full touch-none select-none items-center cursor-pointer",
				className,
			)}
			onMouseDown={handleMouseDown}
			{...rest}
		>
			<div
				ref={trackRef}
				className={clsx(
					"relative h-1 w-full grow overflow-hidden rounded-full select-none transition-transform duration-150 ease-out origin-center",
					isTouching && "scale-y-[2.5]",
					!isBuffering && variant === "default" && "bg-secondary",
					isBuffering && "buffer-track",
					isBuffering &&
						variant === "secondary" &&
						"buffer-secondary",
					!isBuffering &&
						variant === "secondary" &&
						(contrast?.sliderTrackColor ??
							"bg-muted-foreground/70"),
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
							(contrast?.sliderRangeColor ??
								"bg-secondary-foreground"),
					)}
					style={{ width: `${percentage}%` }}
				/>
			</div>

			<div
				className={clsx(
					"absolute top-1/2 h-4 w-4 sm:h-3 sm:w-3 cursor-pointer select-none rounded-full border-2",
					"ring-offset-background transition-[background-color,opacity]",
					"focus-visible:outline-none focus-visible:ring-transparent",
					"disabled:pointer-events-none disabled:opacity-50 transform-gpu",
					"opacity-0 group-hover:opacity-100",
					variant === "default" &&
						"bg-foreground border-foreground",
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
}
