import {
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

const POINTER_SENSOR_OPTIONS = {
  activationConstraint: { distance: 5 },
};

const TOUCH_SENSOR_OPTIONS = {
  activationConstraint: { delay: 200, tolerance: 5 },
};

export function useQueueDndSensors() {
  return useSensors(
    useSensor(PointerSensor, POINTER_SENSOR_OPTIONS),
    useSensor(TouchSensor, TOUCH_SENSOR_OPTIONS),
  );
}
