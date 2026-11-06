package com.praneth2580.ridecore;

import android.content.Context;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.telephony.SignalStrength;
import android.telephony.TelephonyManager;
import com.getcapacitor.JSObject;

/**
 * The phone's state a rider glances at, for the dash's corners: whether there's a SIM and
 * how strong its signal is, Wi-Fi, being offline or in airplane mode, and a headset
 * (Bluetooth or wired) to hear navigation in. None of it needs a permission: the signal
 * is the level only, not the network type, which would need READ_PHONE_STATE.
 */
final class RideCoreStatus {

    interface Listener {
        void onChange(JSObject status);
    }

    /** Several network callbacks arrive together: one update for them. */
    private static final long SETTLE_MS = 300;

    private final Context context;
    private final Listener listener;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable emit = this::emit;
    private ConnectivityManager.NetworkCallback networkCallback;
    private AudioDeviceCallback audioCallback;

    RideCoreStatus(Context context, Listener listener) {
        this.context = context.getApplicationContext();
        this.listener = listener;
    }

    void start() {
        ConnectivityManager connectivity = connectivity();
        if (connectivity != null && networkCallback == null) {
            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    changed();
                }

                @Override
                public void onLost(Network network) {
                    changed();
                }

                @Override
                public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) {
                    changed();
                }
            };
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) connectivity.registerDefaultNetworkCallback(networkCallback);
                else connectivity.registerNetworkCallback(new NetworkRequest.Builder().build(), networkCallback);
            } catch (RuntimeException e) {
                networkCallback = null;
            }
        }
        AudioManager audio = audio();
        if (audio != null && audioCallback == null) {
            audioCallback = new AudioDeviceCallback() {
                @Override
                public void onAudioDevicesAdded(AudioDeviceInfo[] added) {
                    changed();
                }

                @Override
                public void onAudioDevicesRemoved(AudioDeviceInfo[] removed) {
                    changed();
                }
            };
            audio.registerAudioDeviceCallback(audioCallback, main);
        }
    }

    void stop() {
        ConnectivityManager connectivity = connectivity();
        if (connectivity != null && networkCallback != null) {
            try {
                connectivity.unregisterNetworkCallback(networkCallback);
            } catch (RuntimeException ignored) {
                // Already gone.
            }
        }
        networkCallback = null;
        AudioManager audio = audio();
        if (audio != null && audioCallback != null) audio.unregisterAudioDeviceCallback(audioCallback);
        audioCallback = null;
        main.removeCallbacks(emit);
    }

    private void changed() {
        main.removeCallbacks(emit);
        main.postDelayed(emit, SETTLE_MS);
    }

    private void emit() {
        listener.onChange(snapshot());
    }

    JSObject snapshot() {
        JSObject status = new JSObject();
        status.put("supported", true);
        status.put("network", network());
        status.put("headset", headset());
        return status;
    }

    private JSObject network() {
        JSObject network = new JSObject();
        boolean airplane = Settings.Global.getInt(context.getContentResolver(), Settings.Global.AIRPLANE_MODE_ON, 0) == 1;
        network.put("airplane", airplane);

        TelephonyManager phone = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
        int sim = phone != null ? phone.getSimState() : TelephonyManager.SIM_STATE_ABSENT;
        boolean hasSim = sim != TelephonyManager.SIM_STATE_ABSENT && sim != TelephonyManager.SIM_STATE_UNKNOWN;
        network.put("sim", hasSim);
        if (hasSim && phone != null) {
            String operator = phone.getNetworkOperatorName();
            if (operator != null && !operator.isEmpty()) network.put("operator", operator);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                try {
                    SignalStrength strength = phone.getSignalStrength();
                    if (strength != null) network.put("level", strength.getLevel());
                } catch (RuntimeException ignored) {
                    // Some phones won't say; the bars are left out.
                }
            }
        }

        ConnectivityManager connectivity = connectivity();
        NetworkCapabilities capabilities = null;
        if (connectivity != null) {
            try {
                Network active = connectivity.getActiveNetwork();
                capabilities = active != null ? connectivity.getNetworkCapabilities(active) : null;
            } catch (RuntimeException ignored) {
                capabilities = null;
            }
        }
        network.put("wifi", capabilities != null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI));
        network.put("mobileData", capabilities != null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR));
        network.put(
            "online",
            capabilities != null &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        );
        return network;
    }

    private JSObject headset() {
        JSObject headset = new JSObject();
        AudioManager audio = audio();
        AudioDeviceInfo found = null;
        String kind = null;
        if (audio != null) {
            for (AudioDeviceInfo device : audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
                String type = kindOf(device.getType());
                if (type == null) continue;
                // Bluetooth first: a helmet's intercom over a wired pair of earphones.
                if (found == null || ("bluetooth".equals(type) && !"bluetooth".equals(kind))) {
                    found = device;
                    kind = type;
                }
            }
        }
        headset.put("connected", found != null);
        if (found != null) {
            headset.put("kind", kind);
            CharSequence name = found.getProductName();
            if (name != null && name.length() > 0 && !name.toString().equals(Build.MODEL)) headset.put("name", name.toString());
        }
        return headset;
    }

    private static String kindOf(int type) {
        switch (type) {
            case AudioDeviceInfo.TYPE_BLUETOOTH_A2DP:
            case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
            case 26: // TYPE_BLE_HEADSET, Android 12
            case 27: // TYPE_BLE_SPEAKER, Android 12
                return "bluetooth";
            case AudioDeviceInfo.TYPE_WIRED_HEADSET:
            case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:
            case AudioDeviceInfo.TYPE_USB_HEADSET:
                return "wired";
            default:
                return null;
        }
    }

    private ConnectivityManager connectivity() {
        return (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
    }

    private AudioManager audio() {
        return (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
    }
}
