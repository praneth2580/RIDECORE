package com.praneth2580.ridecore;

import android.Manifest;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.media.AudioManager;
import android.os.Build;
import android.os.SystemClock;
import android.telecom.TelecomManager;
import android.telephony.TelephonyManager;
import android.view.KeyEvent;
import androidx.core.content.ContextCompat;
import androidx.core.content.IntentCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * RIDECORE's handlebar module on USB (module/README.md): a board with the bike's buttons,
 * a wheel sensor and an IMU, sending a line of JSON per reading. The phone is the USB
 * host, through a hub that charges it at the same time.
 *
 * Plugged in, Android offers to open RIDECORE for it (the manifest's
 * USB_DEVICE_ATTACHED filter, res/xml/ridecore_usb_module.xml); "always" there gives
 * lasting access. Found any other way it asks for access once.
 *
 * The buttons are read here: taps and holds, and what the rider set each to do
 * (src/ridecore/module/buttonmap.ts). What the phone does (calls, volume, and music with
 * RIDECORE behind another app) is done here at once; what the screens do goes to the
 * page as a "press". Everything else goes to the page as lines: src/ridecore/module/.
 * Registered in MainActivity.
 */
@CapacitorPlugin(
    name = "RideCoreModule",
    permissions = { @Permission(alias = "calls", strings = { Manifest.permission.ANSWER_PHONE_CALLS, Manifest.permission.READ_PHONE_STATE }) }
)
public class RideCoreModulePlugin extends Plugin {

    private static final String ACTION_PERMISSION = "com.praneth2580.ridecore.MODULE_USB_PERMISSION";
    private static final String PREFS = "ridecore-module";
    private static final String BUTTONS = "buttons";
    /**
     * Makers whose boards it asks about by itself when it finds one plugged in. As
     * res/xml/ridecore_usb_module.xml: Espressif, Arduino (and arduino.org), SparkFun,
     * Raspberry Pi, Adafruit, WCH (CH340), Silicon Labs (CP210x), FTDI.
     */
    private static final Set<Integer> MAKERS = new HashSet<>(Arrays.asList(0x303A, 0x2341, 0x2A03, 0x1B4F, 0x2E8A, 0x239A, 0x1A86, 0x10C4, 0x0403));

    private UsbManager usb;
    private RideCoreUsbLink link;
    private RideCoreButtons buttons;
    private String state = "none";
    private String name;
    private String error;
    /** Asked once this run, finding it by itself; after that the rider taps Module. */
    private boolean askedThisRun;
    /** RIDECORE on screen: the page can act on a press. Behind another app it can't, in time. */
    private volatile boolean inFront = true;
    /** What each button does, "up.tap" → "screen-up"; set by the page, kept for next time. */
    private final Map<String, String> map = new HashMap<>();
    /** While the phone rings or a call is on, OK answers (tap) and hangs up (hold). */
    private boolean callsOnOk;

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            UsbDevice device = IntentCompat.getParcelableExtra(intent, UsbManager.EXTRA_DEVICE, UsbDevice.class);
            if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(intent.getAction())) {
                RideCoreUsbLink current = link;
                if (current != null && device != null && device.getDeviceName().equals(current.deviceName())) closeLink("none", null);
                else if (current == null) find(false);
            } else if (ACTION_PERMISSION.equals(intent.getAction())) {
                boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                if (granted && device != null) open(device);
                else setState("allow", null, null);
            }
        }
    };

    @Override
    public void load() {
        usb = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        buttons = new RideCoreButtons(this::onPress);
        loadButtons(getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(BUTTONS, null));
        IntentFilter filter = new IntentFilter();
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        filter.addAction(ACTION_PERMISSION);
        ContextCompat.registerReceiver(getContext(), receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
        // Started by plugging it in: that intent carries the device, and access to it.
        Intent launch = getActivity() != null ? getActivity().getIntent() : null;
        if (!openFromIntent(launch)) find(false);
    }

    /** Plugged in while RIDECORE runs: Android hands it over (singleTask, so a new intent). */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        openFromIntent(intent);
    }

    /** Back in front: plugged in while away, or access given in Android's settings. */
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        inFront = true;
        if (link == null && !"asking".equals(state)) find(false);
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        inFront = false;
    }

    @Override
    protected void handleOnDestroy() {
        try {
            getContext().unregisterReceiver(receiver);
        } catch (IllegalArgumentException ignored) {
            // Never registered.
        }
        if (link != null) link.close();
        link = null;
        super.handleOnDestroy();
    }

    // ── Calls from the page ─────────────────────────────────────────────────

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(stateObject());
    }

    /** The rider tapped Module: find it again, asking for access if it needs it. */
    @PluginMethod
    public void connect(PluginCall call) {
        if (link == null) find(true);
        call.resolve(stateObject());
    }

    @PluginMethod
    public void send(PluginCall call) {
        String line = call.getString("line");
        if (line == null) {
            call.reject("line is required");
            return;
        }
        RideCoreUsbLink current = link;
        if (current == null || !current.write(line)) {
            call.reject("The module isn't connected");
            return;
        }
        call.resolve();
    }

    /** What each button does, and whether OK takes calls: { map: {"up.tap": "screen-up", …}, callsOnOk }. */
    @PluginMethod
    public void setButtons(PluginCall call) {
        JSObject settings = new JSObject();
        JSObject given = call.getObject("map", new JSObject());
        settings.put("map", given);
        settings.put("callsOnOk", Boolean.TRUE.equals(call.getBoolean("callsOnOk", false)));
        loadButtons(settings.toString());
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(BUTTONS, settings.toString()).apply();
        call.resolve();
    }

    /** Answering and ending calls from a button: Android asks the rider once. */
    @PluginMethod
    public void allowCalls(PluginCall call) {
        if (getPermissionState("calls") == PermissionState.GRANTED) {
            call.resolve(callsObject());
            return;
        }
        requestPermissionForAlias("calls", call, "callsAnswered");
    }

    @PermissionCallback
    private void callsAnswered(PluginCall call) {
        call.resolve(callsObject());
    }

    // ── The buttons ─────────────────────────────────────────────────────────

    private void loadButtons(String json) {
        map.clear();
        callsOnOk = false;
        if (json == null) return;
        try {
            JSONObject settings = new JSONObject(json);
            JSONObject given = settings.optJSONObject("map");
            if (given != null) {
                for (Iterator<String> keys = given.keys(); keys.hasNext();) {
                    String key = keys.next();
                    map.put(key, given.optString(key, "none"));
                }
            }
            callsOnOk = settings.optBoolean("callsOnOk", false);
        } catch (JSONException ignored) {
            // Unreadable: the page sends it again as it starts.
        }
    }

    /** A tap or a hold: what it's set to do, done here or by the page. On the main thread. */
    private void onPress(int button, boolean hold) {
        String key = RideCoreButtons.NAMES[button] + (hold ? ".hold" : ".tap");
        String action = map.containsKey(key) ? map.get(key) : "page";
        String problem = null;
        boolean done = false;

        // A call coming in, or on: OK is for it, whatever OK is set to.
        if (callsOnOk && button == RideCoreButtons.OK) {
            String call = callState();
            if ("ringing".equals(call)) action = hold ? "end-call" : "answer-call";
            else if ("on".equals(call) && hold) action = "end-call";
        }

        switch (action) {
            case "volume-up":
            case "volume-down":
                adjustVolume("volume-up".equals(action));
                done = true;
                break;
            case "answer-call":
                problem = answerCall();
                done = true;
                break;
            case "end-call":
                problem = endCall();
                done = true;
                break;
            case "none":
                return;
            default:
                if (inFront) break;
                // Behind another app the page can't act in time: the phone does what it can.
                done = background(action);
        }

        if (!inFront) return;
        JSObject event = new JSObject();
        event.put("button", RideCoreButtons.NAMES[button]);
        event.put("hold", hold);
        event.put("action", action);
        event.put("done", done);
        if (problem != null) event.put("problem", problem);
        notifyListeners("press", event);
    }

    /** Music as a headset's buttons work it; anything for the screens brings RIDECORE back. */
    private boolean background(String action) {
        switch (action) {
            case "play-pause":
                return mediaKey(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE);
            case "next-track":
                return mediaKey(KeyEvent.KEYCODE_MEDIA_NEXT);
            case "previous-track":
                return mediaKey(KeyEvent.KEYCODE_MEDIA_PREVIOUS);
            default:
                // As pressing Home with RIDECORE the home screen: back to the dash.
                try {
                    Intent home = new Intent(Intent.ACTION_MAIN)
                        .addCategory(Intent.CATEGORY_HOME)
                        .setPackage(getContext().getPackageName())
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(home);
                } catch (RuntimeException ignored) {
                    // Android may not let it come forward from behind; nothing else to do.
                }
                return true;
        }
    }

    private boolean mediaKey(int code) {
        AudioManager audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audio == null) return false;
        long now = SystemClock.uptimeMillis();
        audio.dispatchMediaKeyEvent(new KeyEvent(now, now, KeyEvent.ACTION_DOWN, code, 0));
        audio.dispatchMediaKeyEvent(new KeyEvent(now, now, KeyEvent.ACTION_UP, code, 0));
        return true;
    }

    /** As the phone's own volume keys: the call's volume in a call, else the music's. */
    private void adjustVolume(boolean up) {
        AudioManager audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audio == null) return;
        audio.adjustSuggestedStreamVolume(up ? AudioManager.ADJUST_RAISE : AudioManager.ADJUST_LOWER, AudioManager.USE_DEFAULT_STREAM_TYPE, AudioManager.FLAG_SHOW_UI);
    }

    // ── Calls ───────────────────────────────────────────────────────────────

    private TelecomManager telecom() {
        return (TelecomManager) getContext().getSystemService(Context.TELECOM_SERVICE);
    }

    /** "ringing", "on" or "none"; "none" too without the phone permission. */
    @SuppressWarnings({"MissingPermission", "deprecation"})
    private String callState() {
        TelephonyManager phone = (TelephonyManager) getContext().getSystemService(Context.TELEPHONY_SERVICE);
        if (phone == null || getPermissionState("calls") != PermissionState.GRANTED) return "none";
        try {
            int call = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? phone.getCallStateForSubscription() : phone.getCallState();
            if (call == TelephonyManager.CALL_STATE_RINGING) return "ringing";
            if (call == TelephonyManager.CALL_STATE_OFFHOOK) return "on";
        } catch (SecurityException ignored) {
            // Taken back in Android's settings.
        }
        return "none";
    }

    /** Null when done, else what's in the way, for the page to say. */
    @SuppressWarnings("MissingPermission")
    private String answerCall() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return "Answering needs Android 8 or later";
        if (getPermissionState("calls") != PermissionState.GRANTED) return "Allow calls: Settings → Handlebar module → Calls";
        try {
            telecom().acceptRingingCall();
            return null;
        } catch (SecurityException e) {
            return "Allow calls: Settings → Handlebar module → Calls";
        }
    }

    @SuppressWarnings({"MissingPermission", "deprecation"})
    private String endCall() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return "Ending calls needs Android 9 or later";
        if (getPermissionState("calls") != PermissionState.GRANTED) return "Allow calls: Settings → Handlebar module → Calls";
        try {
            telecom().endCall();
            return null;
        } catch (SecurityException e) {
            return "Allow calls: Settings → Handlebar module → Calls";
        }
    }

    private JSObject callsObject() {
        JSObject result = new JSObject();
        result.put("calls", getPermissionState("calls").toString());
        return result;
    }

    // ── The USB line ────────────────────────────────────────────────────────

    private boolean openFromIntent(Intent intent) {
        if (intent == null || !UsbManager.ACTION_USB_DEVICE_ATTACHED.equals(intent.getAction())) return false;
        UsbDevice device = IntentCompat.getParcelableExtra(intent, UsbManager.EXTRA_DEVICE, UsbDevice.class);
        if (device == null || RideCoreUsbLink.driverFor(device) == null) return false;
        if (link == null) open(device);
        return true;
    }

    /** The module among what's plugged in: opened if allowed, else asked for when `ask`. */
    private void find(boolean ask) {
        if (usb == null) return;
        UsbDevice found = null;
        for (UsbDevice device : usb.getDeviceList().values()) {
            if (RideCoreUsbLink.driverFor(device) == null) continue;
            // A known maker's board first; any other serial device if that's all there is.
            if (found == null || (MAKERS.contains(device.getVendorId()) && !MAKERS.contains(found.getVendorId()))) found = device;
        }
        if (found == null) {
            setState("none", null, null);
            return;
        }
        if (usb.hasPermission(found)) {
            open(found);
        } else if (ask || (!askedThisRun && MAKERS.contains(found.getVendorId()))) {
            askedThisRun = true;
            Intent intent = new Intent(ACTION_PERMISSION).setPackage(getContext().getPackageName());
            int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
            usb.requestPermission(found, PendingIntent.getBroadcast(getContext(), 0, intent, flags));
            setState("asking", found.getProductName(), null);
        } else {
            setState("allow", found.getProductName(), null);
        }
    }

    private synchronized void open(UsbDevice device) {
        if (link != null) return;
        try {
            link = RideCoreUsbLink.open(usb, device, new RideCoreUsbLink.Listener() {
                @Override
                public void onLines(List<String> lines) {
                    // The buttons are read here (RideCoreButtons); the rest is the page's.
                    List<String> rest = new ArrayList<>(lines.size());
                    for (String line : lines) {
                        if (!line.contains("\"t\":\"btn\"")) {
                            rest.add(line);
                            continue;
                        }
                        try {
                            JSONObject edge = new JSONObject(line);
                            buttons.edge(edge.getInt("b"), edge.getInt("s") == 1);
                        } catch (JSONException ignored) {
                            // A garbled line: dropped.
                        }
                    }
                    if (rest.isEmpty()) return;
                    JSObject event = new JSObject();
                    event.put("lines", new JSArray(rest));
                    notifyListeners("lines", event);
                }

                @Override
                public void onClosed(String reason) {
                    link = null;
                    buttons.reset();
                    setState("error", null, reason);
                }
            });
            setState("open", link.name(), null);
        } catch (IOException | RuntimeException e) {
            link = null;
            setState("error", device.getProductName(), e.getMessage());
        }
    }

    private synchronized void closeLink(String next, String reason) {
        if (link != null) link.close();
        link = null;
        buttons.reset();
        setState(next, null, reason);
    }

    private void setState(String next, String nextName, String nextError) {
        state = next;
        name = nextName;
        error = nextError;
        notifyListeners("state", stateObject());
    }

    private JSObject stateObject() {
        JSObject result = new JSObject();
        result.put("state", state);
        if (name != null) result.put("name", name);
        if (error != null) result.put("error", error);
        result.put("calls", getPermissionState("calls").toString());
        return result;
    }
}
