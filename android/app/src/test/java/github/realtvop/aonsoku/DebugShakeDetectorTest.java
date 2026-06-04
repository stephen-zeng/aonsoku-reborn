package github.realtvop.aonsoku;

import static org.junit.Assert.assertEquals;
import org.junit.Test;
import android.hardware.Sensor;

public class DebugShakeDetectorTest {

    private int shakeCount = 0;
    private final DebugShakeDetector.OnShakeListener mockListener = new DebugShakeDetector.OnShakeListener() {
        @Override
        public void onShake() {
            shakeCount++;
        }
    };

    @Test
    public void testValidShakeSequenceTriggers() {
        DebugShakeDetector detector = new DebugShakeDetector(mockListener);
        shakeCount = 0;

        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{10.0f, 0.0f, 0.0f}, 1000);
        assertEquals(0, shakeCount);

        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{-10.0f, 0.0f, 0.0f}, 1100);
        assertEquals(0, shakeCount);

        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{10.0f, 0.0f, 0.0f}, 1200);
        assertEquals(1, shakeCount);
    }

    @Test
    public void testHighAccelerationSameDirectionDoesNotTrigger() {
        DebugShakeDetector detector = new DebugShakeDetector(mockListener);
        shakeCount = 0;

        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{10.0f, 0.0f, 0.0f}, 1000);
        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{10.0f, 0.0f, 0.0f}, 1100);
        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{10.0f, 0.0f, 0.0f}, 1200);

        assertEquals(0, shakeCount);
    }

    @Test
    public void testSingleSpikeDoesNotTrigger() {
        DebugShakeDetector detector = new DebugShakeDetector(mockListener);
        shakeCount = 0;

        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{15.0f, 5.0f, -2.0f}, 1000);
        assertEquals(0, shakeCount);
    }

    @Test
    public void testStrokesTooSlowExpired() {
        DebugShakeDetector detector = new DebugShakeDetector(mockListener);
        shakeCount = 0;

        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{10.0f, 0.0f, 0.0f}, 1000);
        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{-10.0f, 0.0f, 0.0f}, 2500);
        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{10.0f, 0.0f, 0.0f}, 4000);

        assertEquals(0, shakeCount);
    }

    @Test
    public void testCooldownIsolationAndSubsequentTrigger() {
        DebugShakeDetector detector = new DebugShakeDetector(mockListener);
        shakeCount = 0;

        // First trigger
        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{10.0f, 0.0f, 0.0f}, 1000);
        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{-10.0f, 0.0f, 0.0f}, 1100);
        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{10.0f, 0.0f, 0.0f}, 1200);
        assertEquals(1, shakeCount);

        // During cooldown (until 3200ms)
        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{10.0f, 0.0f, 0.0f}, 2000);
        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{-10.0f, 0.0f, 0.0f}, 2100);
        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{10.0f, 0.0f, 0.0f}, 2200);
        assertEquals(1, shakeCount);

        // After cooldown (time >= 3200ms)
        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{10.0f, 0.0f, 0.0f}, 3300);
        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{-10.0f, 0.0f, 0.0f}, 3400);
        detector.handleSensorData(Sensor.TYPE_LINEAR_ACCELERATION, new float[]{10.0f, 0.0f, 0.0f}, 3500);
        assertEquals(2, shakeCount);
    }

    @Test
    public void testAccelerometerFallbackWithLowPassFilter() {
        DebugShakeDetector detector = new DebugShakeDetector(mockListener);
        shakeCount = 0;

        // Establish gravity first: static acceleration [0, 9.8, 0] -> gravity ~ [0, 9.8, 0], linear ~ [0, 0, 0]
        detector.handleSensorData(Sensor.TYPE_ACCELEROMETER, new float[]{0.0f, 9.8f, 0.0f}, 1000);
        assertEquals(0, shakeCount);

        // Stroke 1: rapid shift positive on X-axis: total accel [15, 9.8, 0]
        // Gravity update: X: 0.8 * 0 + 0.2 * 15 = 3; linear X: 15 - 3 = 12 (mag > 9)
        detector.handleSensorData(Sensor.TYPE_ACCELEROMETER, new float[]{15.0f, 9.8f, 0.0f}, 1100);
        assertEquals(0, shakeCount);

        // Stroke 2: rapid shift negative on X-axis: total accel [-15, 9.8, 0]
        // Gravity update: X: 0.8 * 3 + 0.2 * -15 = 2.4 - 3 = -0.6; linear X: -15 - (-0.6) = -14.4 (mag > 9, opposite dir)
        detector.handleSensorData(Sensor.TYPE_ACCELEROMETER, new float[]{-15.0f, 9.8f, 0.0f}, 1200);
        assertEquals(0, shakeCount);

        // Stroke 3: rapid shift positive on X-axis: total accel [15, 9.8, 0]
        // Gravity update: X: 0.8 * -0.6 + 0.2 * 15 = -0.48 + 3 = 2.52; linear X: 15 - 2.52 = 12.48 (mag > 9, opposite dir)
        detector.handleSensorData(Sensor.TYPE_ACCELEROMETER, new float[]{15.0f, 9.8f, 0.0f}, 1300);

        // Should trigger
        assertEquals(1, shakeCount);
    }
}
