package com.praneth2580.ridecore;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * RIDECORE on a phone kept for it alone: the screen layout the rider picked, held
 * whichever way the phone is turned, and RIDECORE as the phone's home screen.
 * Web side: src/ridecore/device.ts. Registered in MainActivity.
 */
@CapacitorPlugin(name = "RideCoreDevice")
public class RideCoreDevicePlugin extends Plugin {

    private static final String PREFS = "ridecore-device";
    private static final String LAYOUT = "layout";

    @Override
    public void load() {
        // As the app starts, before the page draws, so the screen never turns the wrong way first.
        apply(prefs().getString(LAYOUT, null));
    }

    @PluginMethod
    public void getLayout(PluginCall call) {
        JSObject result = new JSObject();
        String layout = prefs().getString(LAYOUT, null);
        // Left out until the rider has picked one.
        if (layout != null) result.put("layout", layout);
        call.resolve(result);
    }

    @PluginMethod
    public void setLayout(PluginCall call) {
        String layout = call.getString("layout");
        if (!"landscape".equals(layout) && !"portrait".equals(layout)) {
            call.reject("layout must be landscape or portrait");
            return;
        }
        prefs().edit().putString(LAYOUT, layout).apply();
        getActivity().runOnUiThread(() -> {
            apply(layout);
            call.resolve();
        });
    }

    /** Whether pressing Home opens RIDECORE. */
    @PluginMethod
    public void getHomeStatus(PluginCall call) {
        Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        ResolveInfo resolved = getContext()
            .getPackageManager()
            .resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY);
        boolean isHome = resolved != null &&
            resolved.activityInfo != null &&
            getContext().getPackageName().equals(resolved.activityInfo.packageName);
        JSObject result = new JSObject();
        result.put("supported", true);
        result.put("isHome", isHome);
        call.resolve(result);
    }

    /** Android's "Default home app" screen. */
    @PluginMethod
    public void openHomeSettings(PluginCall call) {
        open(Settings.ACTION_HOME_SETTINGS);
        call.resolve();
    }

    /** Android's own settings: Wi-Fi, Bluetooth, the rest of the phone. */
    @PluginMethod
    public void openSettings(PluginCall call) {
        open(Settings.ACTION_SETTINGS);
        call.resolve();
    }

    private void open(String action) {
        try {
            getContext().startActivity(new Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (ActivityNotFoundException e) {
            // Some phones hide the home app screen; their settings list has it.
            getContext().startActivity(new Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
    }

    /** Either way up within the layout, so the phone can be mounted turned round. */
    private void apply(String layout) {
        if (getActivity() == null) return;
        int orientation = "landscape".equals(layout)
            ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            : "portrait".equals(layout)
                ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
                : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
        getActivity().setRequestedOrientation(orientation);
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
