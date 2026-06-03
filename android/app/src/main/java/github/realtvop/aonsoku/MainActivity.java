package github.realtvop.aonsoku;

import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import com.getcapacitor.BridgeActivity;
import github.realtvop.aonsoku.plugins.audio.AudioPlugin;
import github.realtvop.aonsoku.plugins.bridge.BridgePlugin;
import github.realtvop.aonsoku.plugins.data.DataPlugin;
import github.realtvop.aonsoku.plugins.preferences.PreferencesPlugin;
import github.realtvop.aonsoku.plugins.debug.DebugActivity;

public class MainActivity extends BridgeActivity implements SensorEventListener {
    private SensorManager sensorManager;
    private Sensor accelerometer;
    private float lastX, lastY, lastZ;
    private long lastShakeTime;
    private boolean hasInitialValues;
    private static final float SHAKE_THRESHOLD = 12f;
    private static final long SHAKE_COOLDOWN_MS = 2000;

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AudioPlugin.class);
        registerPlugin(BridgePlugin.class);
        registerPlugin(DataPlugin.class);
        registerPlugin(PreferencesPlugin.class);

        super.onCreate(savedInstanceState);
        sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
        if (sensorManager != null) {
            accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (sensorManager != null && accelerometer != null) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        hasInitialValues = false;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        float x = event.values[0];
        float y = event.values[1];
        float z = event.values[2];

        if (!hasInitialValues) {
            lastX = x;
            lastY = y;
            lastZ = z;
            hasInitialValues = true;
            return;
        }

        float deltaX = Math.abs(x - lastX);
        float deltaY = Math.abs(y - lastY);
        float deltaZ = Math.abs(z - lastZ);

        lastX = x;
        lastY = y;
        lastZ = z;

        if (deltaX > SHAKE_THRESHOLD || deltaY > SHAKE_THRESHOLD || deltaZ > SHAKE_THRESHOLD) {
            long now = System.currentTimeMillis();
            if (now - lastShakeTime > SHAKE_COOLDOWN_MS) {
                lastShakeTime = now;
                openDebugPage();
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
    }

    private void openDebugPage() {
        android.util.Log.d("MainActivity", "Shake detected, opening debug page");
        runOnUiThread(() -> {
            if (isFinishing() || isDestroyed()) {
                return;
            }
            try {
                Intent intent = new Intent(MainActivity.this, DebugActivity.class);
                startActivity(intent);
            } catch (Throwable t) {
                android.util.Log.e("MainActivity", "Failed to open debug page", t);
            }
        });
    }

    @Override
    public boolean dispatchKeyEvent(android.view.KeyEvent event) {
        if (AudioPlugin.isVolumeHUDDisabled()) {
            int keyCode = event.getKeyCode();
            if (keyCode == android.view.KeyEvent.KEYCODE_VOLUME_UP || keyCode == android.view.KeyEvent.KEYCODE_VOLUME_DOWN) {
                if (event.getAction() == android.view.KeyEvent.ACTION_DOWN) {
                    android.media.AudioManager audioManager = (android.media.AudioManager) getSystemService(AUDIO_SERVICE);
                    if (audioManager != null) {
                        int direction = (keyCode == android.view.KeyEvent.KEYCODE_VOLUME_UP) 
                            ? android.media.AudioManager.ADJUST_RAISE 
                            : android.media.AudioManager.ADJUST_LOWER;
                        audioManager.adjustStreamVolume(android.media.AudioManager.STREAM_MUSIC, direction, 0);
                    }
                }
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }
}
