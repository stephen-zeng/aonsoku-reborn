package github.realtvop.aonsoku;

import android.hardware.Sensor;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

public class DebugShakeDetector {
    public interface OnShakeListener {
        void onShake();
    }

    private static final float SHAKE_THRESHOLD = 9.0f;
    private static final long MIN_STROKE_INTERVAL_MS = 80;
    private static final long SLIDING_WINDOW_MS = 1400;
    private static final int REQUIRED_STROKES = 3;
    private static final long COOLDOWN_MS = 2000;

    private final OnShakeListener listener;
    private final float[] gravity = new float[3];
    private boolean hasGravity = false;

    private static class Stroke {
        final long timestamp;
        final float[] direction;

        Stroke(long timestamp, float[] direction) {
            this.timestamp = timestamp;
            this.direction = direction;
        }
    }

    private final List<Stroke> strokes = new ArrayList<>();
    private long cooldownEndTime = 0;

    public DebugShakeDetector(OnShakeListener listener) {
        this.listener = listener;
    }

    public void handleSensorData(int sensorType, float[] values, long timestampMs) {
        if (timestampMs < cooldownEndTime) {
            strokes.clear();
            return;
        }

        float[] linearAcceleration = new float[3];

        if (sensorType == Sensor.TYPE_LINEAR_ACCELERATION) {
            linearAcceleration[0] = values[0];
            linearAcceleration[1] = values[1];
            linearAcceleration[2] = values[2];
        } else if (sensorType == Sensor.TYPE_ACCELEROMETER) {
            if (!hasGravity) {
                gravity[0] = values[0];
                gravity[1] = values[1];
                gravity[2] = values[2];
                hasGravity = true;
            } else {
                final float alpha = 0.8f;
                gravity[0] = alpha * gravity[0] + (1 - alpha) * values[0];
                gravity[1] = alpha * gravity[1] + (1 - alpha) * values[1];
                gravity[2] = alpha * gravity[2] + (1 - alpha) * values[2];
            }
            linearAcceleration[0] = values[0] - gravity[0];
            linearAcceleration[1] = values[1] - gravity[1];
            linearAcceleration[2] = values[2] - gravity[2];
        } else {
            return;
        }

        double magnitude = Math.sqrt(
            linearAcceleration[0] * linearAcceleration[0] +
            linearAcceleration[1] * linearAcceleration[1] +
            linearAcceleration[2] * linearAcceleration[2]
        );

        if (magnitude >= SHAKE_THRESHOLD) {
            long lastStrokeTime = strokes.isEmpty() ? 0 : strokes.get(strokes.size() - 1).timestamp;
            if (timestampMs - lastStrokeTime >= MIN_STROKE_INTERVAL_MS) {
                pruneOldStrokes(timestampMs);

                boolean isDirectionValid = false;
                if (strokes.isEmpty()) {
                    isDirectionValid = true;
                } else {
                    float[] prevDirection = strokes.get(strokes.size() - 1).direction;
                    float dotProduct = linearAcceleration[0] * prevDirection[0] +
                                       linearAcceleration[1] * prevDirection[1] +
                                       linearAcceleration[2] * prevDirection[2];
                    if (dotProduct < 0) {
                        isDirectionValid = true;
                    }
                }

                if (isDirectionValid) {
                    strokes.add(new Stroke(timestampMs, linearAcceleration.clone()));

                    if (strokes.size() >= REQUIRED_STROKES) {
                        strokes.clear();
                        cooldownEndTime = timestampMs + COOLDOWN_MS;
                        if (listener != null) {
                            listener.onShake();
                        }
                    }
                }
            }
        }
    }

    private void pruneOldStrokes(long currentTimestampMs) {
        long thresholdTime = currentTimestampMs - SLIDING_WINDOW_MS;
        Iterator<Stroke> iterator = strokes.iterator();
        while (iterator.hasNext()) {
            Stroke stroke = iterator.next();
            if (stroke.timestamp < thresholdTime) {
                iterator.remove();
            }
        }
    }

    public void reset() {
        strokes.clear();
        hasGravity = false;
        cooldownEndTime = 0;
    }
}
