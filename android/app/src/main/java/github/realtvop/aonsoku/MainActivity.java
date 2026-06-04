package github.realtvop.aonsoku;

import android.content.Intent;
import android.content.pm.ActivityInfo;
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
import android.view.View;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

public class MainActivity extends BridgeActivity implements SensorEventListener {
    private SensorManager sensorManager;
    private Sensor accelerometer;
    private long lastShakeTime;
    private long lastCheckTime;
    private int shakeCount;
    private static final float MIN_ACCEL = 14f;
    private static final int REQUIRED_SHAKES = 3;
    private static final long SHAKE_COOLDOWN_MS = 2000;
    private static final long SHAKE_WINDOW_MS = 500;

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        if (!getResources().getBoolean(R.bool.is_tablet)) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }
        com.google.android.material.color.DynamicColors.applyToActivitiesIfAvailable(this.getApplication());
        registerPlugin(AudioPlugin.class);
        registerPlugin(BridgePlugin.class);
        registerPlugin(DataPlugin.class);
        registerPlugin(PreferencesPlugin.class);

        super.onCreate(savedInstanceState);

        getBridge().getWebView().post(() -> {
            View parent = (View) getBridge().getWebView().getParent();
            ViewCompat.setOnApplyWindowInsetsListener(parent, (v, insets) -> {
                v.setPadding(0, 0, 0, 0);
                return insets;
            });
            getBridge().getWebView().requestApplyInsets();
        });
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
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        float x = event.values[0];
        float y = event.values[1];
        float z = event.values[2];

        double acceleration = Math.sqrt(x * x + y * y + z * z);

        if (acceleration > MIN_ACCEL) {
            long now = System.currentTimeMillis();

            if (now - lastCheckTime > SHAKE_WINDOW_MS) {
                shakeCount = 0;
            }

            lastCheckTime = now;
            shakeCount++;

            if (shakeCount >= REQUIRED_SHAKES) {
                if (now - lastShakeTime > SHAKE_COOLDOWN_MS) {
                    shakeCount = 0;
                    lastShakeTime = now;
                    openDebugPage();
                }
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
