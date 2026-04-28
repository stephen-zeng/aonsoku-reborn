import { useCallback, useEffect, useRef, type WheelEvent } from "react";
import { type CarouselApi } from "@/app/components/ui/carousel";

type EmblaCarouselApi = NonNullable<CarouselApi>;

const HORIZONTAL_WHEEL_THRESHOLD = 4;
const WHEEL_LINE_HEIGHT = 16;
const WHEEL_SNAP_DELAY_MS = 24;
const WHEEL_SNAP_MIN_DURATION = 180;
const WHEEL_SNAP_MAX_DURATION = 420;
const WHEEL_SNAP_DURATION_PER_PX = 0.6;
const WHEEL_SNAP_MIN_VELOCITY = 0.2;
const WHEEL_SNAP_VELOCITY_PROJECTION_MS = 180;
const WHEEL_SNAP_MAX_PROJECTION_RATIO = 0.45;
const WHEEL_DELTA_LINE = 1;
const WHEEL_DELTA_PAGE = 2;

function getNormalizedDeltaX(event: WheelEvent<HTMLDivElement>) {
  if (event.deltaMode === WHEEL_DELTA_LINE) {
    return event.deltaX * WHEEL_LINE_HEIGHT;
  }

  if (event.deltaMode === WHEEL_DELTA_PAGE) {
    return event.deltaX * event.currentTarget.clientWidth;
  }

  return event.deltaX;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getSnapDuration(distance: number, velocity: number) {
  const absDistance = Math.abs(distance);
  const absVelocity = Math.abs(velocity);
  const hasMatchingVelocity =
    absVelocity >= WHEEL_SNAP_MIN_VELOCITY &&
    Math.sign(distance) === Math.sign(velocity);

  if (hasMatchingVelocity) {
    return clamp(
      (absDistance * 2) / absVelocity,
      WHEEL_SNAP_MIN_DURATION,
      WHEEL_SNAP_MAX_DURATION,
    );
  }

  return Math.min(
    WHEEL_SNAP_MAX_DURATION,
    Math.max(
      WHEEL_SNAP_MIN_DURATION,
      absDistance * WHEEL_SNAP_DURATION_PER_PX,
    ),
  );
}

function getSnapProgress(progress: number, distance: number, velocity: number) {
  const hasMatchingVelocity =
    Math.abs(velocity) >= WHEEL_SNAP_MIN_VELOCITY &&
    Math.sign(distance) === Math.sign(velocity);

  if (hasMatchingVelocity) {
    return 1 - (1 - progress) ** 2;
  }

  return 1 - (1 - progress) ** 3;
}

function moveCarouselBy(api: EmblaCarouselApi, distance: number) {
  const engine = api.internalEngine();
  const setScrollFriction = engine.scrollBody.useFriction;
  const scrollBody = setScrollFriction(0);
  const setScrollDuration = scrollBody.useDuration;

  setScrollDuration(0);
  engine.scrollTo.distance(distance, false);
}

export function useEmblaWheelScroll(api: CarouselApi) {
  const wheelRafRef = useRef<number | null>(null);
  const wheelSnapRafRef = useRef<number | null>(null);
  const wheelDeltaRef = useRef(0);
  const wheelFrameTimeRef = useRef<number | null>(null);
  const wheelVelocityRef = useRef(0);
  const wheelSnapTimeoutRef = useRef<ReturnType<
    typeof window.setTimeout
  > | null>(null);

  const cancelSnapAnimation = useCallback(() => {
    if (wheelSnapRafRef.current === null) return;

    window.cancelAnimationFrame(wheelSnapRafRef.current);
    wheelSnapRafRef.current = null;
  }, []);

  const startSnapAnimation = useCallback(
    (api: EmblaCarouselApi) => {
      cancelSnapAnimation();

      const engine = api.internalEngine();
      const velocity = wheelVelocityRef.current;
      const maxProjection =
        engine.containerRect.width * WHEEL_SNAP_MAX_PROJECTION_RATIO;
      const projectedDistance =
        Math.abs(velocity) >= WHEEL_SNAP_MIN_VELOCITY
          ? Math.sign(velocity) *
            Math.min(
              Math.abs(velocity) * WHEEL_SNAP_VELOCITY_PROJECTION_MS,
              maxProjection,
            )
          : 0;
      const snapDistance = engine.scrollTarget.byDistance(
        projectedDistance,
        true,
      ).distance;

      if (Math.abs(snapDistance) < 0.5) {
        api.plugins().autoplay?.reset();
        wheelFrameTimeRef.current = null;
        wheelVelocityRef.current = 0;
        return;
      }

      const duration = getSnapDuration(snapDistance, velocity);
      let startTime: number | null = null;
      let previousDistance = 0;

      const animateSnap = (time: number) => {
        if (startTime === null) {
          startTime = time;
        }

        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = getSnapProgress(
          progress,
          snapDistance,
          velocity,
        );
        const nextDistance = snapDistance * easedProgress;
        const frameDistance = nextDistance - previousDistance;

        previousDistance = nextDistance;

        if (Math.abs(frameDistance) > 0.001) {
          moveCarouselBy(api, frameDistance);
        }

        if (progress < 1) {
          wheelSnapRafRef.current = window.requestAnimationFrame(animateSnap);
          return;
        }

        const finalDistance = snapDistance - previousDistance;

        if (Math.abs(finalDistance) > 0.001) {
          moveCarouselBy(api, finalDistance);
        }

        wheelSnapRafRef.current = null;
        wheelFrameTimeRef.current = null;
        wheelVelocityRef.current = 0;
        api.plugins().autoplay?.reset();
      };

      wheelSnapRafRef.current = window.requestAnimationFrame(animateSnap);
    },
    [cancelSnapAnimation],
  );

  const onWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (!api) return;

      const absDeltaX = Math.abs(event.deltaX);
      const absDeltaY = Math.abs(event.deltaY);
      const deltaX = getNormalizedDeltaX(event);

      if (
        absDeltaX <= absDeltaY ||
        Math.abs(deltaX) < HORIZONTAL_WHEEL_THRESHOLD
      ) {
        return;
      }

      event.preventDefault();
      cancelSnapAnimation();
      api.plugins().autoplay?.reset();
      wheelDeltaRef.current += deltaX;

      if (wheelRafRef.current === null) {
        wheelRafRef.current = window.requestAnimationFrame(() => {
          const wheelDelta = wheelDeltaRef.current;
          wheelDeltaRef.current = 0;
          wheelRafRef.current = null;

          if (!wheelDelta) return;

          const now = performance.now();
          const frameDuration =
            wheelFrameTimeRef.current === null
              ? 16
              : Math.max(now - wheelFrameTimeRef.current, 16);
          const frameDistance = -wheelDelta;

          wheelFrameTimeRef.current = now;
          wheelVelocityRef.current = frameDistance / frameDuration;
          moveCarouselBy(api, frameDistance);
        });
      }

      if (wheelSnapTimeoutRef.current !== null) {
        window.clearTimeout(wheelSnapTimeoutRef.current);
      }

      wheelSnapTimeoutRef.current = window.setTimeout(() => {
        wheelSnapTimeoutRef.current = null;
        startSnapAnimation(api);
      }, WHEEL_SNAP_DELAY_MS);
    },
    [api, cancelSnapAnimation, startSnapAnimation],
  );

  useEffect(() => {
    return () => {
      if (wheelRafRef.current !== null) {
        window.cancelAnimationFrame(wheelRafRef.current);
      }

      if (wheelSnapTimeoutRef.current !== null) {
        window.clearTimeout(wheelSnapTimeoutRef.current);
      }

      cancelSnapAnimation();
    };
  }, [cancelSnapAnimation]);

  return { onWheel };
}
