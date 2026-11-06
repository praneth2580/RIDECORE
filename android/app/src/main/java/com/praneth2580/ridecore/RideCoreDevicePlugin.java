package com.praneth2580.ridecore;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.Window;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.util.List;

/**
 * RIDECORE on a phone kept for it alone: the screen layout the rider picked, held
 * whichever way the phone is turned, and RIDECORE as the phone's home screen, opening
 * the phone's other apps and going back to the dash when Home is pressed, the music the
 * phone plays (RideCoreMedia), and its signal and headset for the dash (RideCoreStatus).
 * Full screen: Android's own bars hidden, the dash shows the time, signal and battery.
 * Web side: src/ridecore/device.ts. Registered in MainActivity.
 */
@CapacitorPlugin(name = "RideCoreDevice")
public class RideCoreDevicePlugin extends Plugin {

    private static final String PREFS = "ridecore-device";
    private static final String LAYOUT = "layout";
    /** App icons are drawn this many dp across: sharp at the size the drawer shows them. */
    private static final int ICON_DP = 56;

    private RideCoreMedia media;
    private RideCoreStatus status;
    /** The screen the page must keep clear, in CSS pixels: the camera's cut-out. */
    private volatile JSObject cutout = sides(Insets.NONE, 1f);
    private final ViewTreeObserver.OnWindowFocusChangeListener refocused = focused -> {
        if (focused) fullScreen();
    };

    @Override
    public void load() {
        // As the app starts, before the page draws, so the screen never turns the wrong way first.
        apply(prefs().getString(LAYOUT, null));
        fullScreen();
        // Back from the notification shade, a permission dialog or the keyboard: hidden again.
        if (getActivity() != null) getActivity().getWindow().getDecorView().getViewTreeObserver().addOnWindowFocusChangeListener(refocused);
        followCutout();
        media = new RideCoreMedia(getContext(), snapshot -> notifyListeners("media", snapshot));
        media.start();
        status = new RideCoreStatus(getContext(), snapshot -> notifyListeners("status", snapshot));
        status.start();
    }

    /** SIM and signal, Wi-Fi or offline, airplane mode, a headset connected. */
    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status.snapshot());
    }

    /** Back from Android's settings, access may have just been given. */
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        fullScreen();
        if (media == null) return;
        media.start();
        notifyListeners("media", media.snapshot());
    }

    @Override
    protected void handleOnDestroy() {
        if (getActivity() != null) {
            ViewTreeObserver observer = getActivity().getWindow().getDecorView().getViewTreeObserver();
            if (observer.isAlive()) observer.removeOnWindowFocusChangeListener(refocused);
        }
        if (media != null) media.stop();
        if (status != null) status.stop();
        super.handleOnDestroy();
    }

    /** What the phone plays now, and whether RIDECORE may see it. */
    @PluginMethod
    public void getMedia(PluginCall call) {
        media.start();
        call.resolve(media.snapshot());
    }

    /** play, pause, toggle, next or previous, to whichever app plays. */
    @PluginMethod
    public void mediaControl(PluginCall call) {
        String action = call.getString("action", "");
        if (media.control(action)) call.resolve();
        else call.reject("Unknown media action: " + action);
    }

    /** Android's notification access screen, where RIDECORE is allowed to see what plays. */
    @PluginMethod
    public void openMediaAccess(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, media.listenerComponent().flattenToString());
        } else {
            intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        }
        try {
            getContext().startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (ActivityNotFoundException e) {
            open(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        }
        call.resolve();
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
            fullScreen();
            call.resolve();
        });
    }

    /** The camera's cut-out, each side in CSS pixels, for the page to keep its words clear of. */
    @PluginMethod
    public void getCutout(PluginCall call) {
        call.resolve(cutout);
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

    /**
     * The phone's apps, as a launcher lists them: each one's name, what opens it, and its
     * icon as a PNG data URL. RIDECORE itself is left out. Seeing them needs the manifest's
     * <queries> entry for launcher activities (Android 11 and later).
     */
    @PluginMethod
    public void listApps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        Intent launchable = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> found = pm.queryIntentActivities(launchable, 0);
        String self = getContext().getPackageName();
        int size = Math.round(ICON_DP * getContext().getResources().getDisplayMetrics().density);
        JSArray apps = new JSArray();
        for (ResolveInfo info : found) {
            if (info.activityInfo == null || self.equals(info.activityInfo.packageName)) continue;
            JSObject app = new JSObject();
            app.put("packageName", info.activityInfo.packageName);
            app.put("activity", info.activityInfo.name);
            app.put("label", String.valueOf(info.loadLabel(pm)));
            String icon = iconDataUrl(info.loadIcon(pm), size);
            if (icon != null) app.put("icon", icon);
            apps.put(app);
        }
        JSObject result = new JSObject();
        result.put("supported", true);
        result.put("apps", apps);
        call.resolve(result);
    }

    /** Opens one of the phone's apps, as tapping its icon on a home screen does. */
    @PluginMethod
    public void openApp(PluginCall call) {
        String packageName = call.getString("packageName");
        String activity = call.getString("activity");
        if (packageName == null) {
            call.reject("packageName is required");
            return;
        }
        Intent intent = activity != null
            ? new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setClassName(packageName, activity)
            : getContext().getPackageManager().getLaunchIntentForPackage(packageName);
        if (intent == null) {
            call.reject("That app is no longer on the phone");
            return;
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("That app is no longer on the phone");
        }
    }

    /** Home pressed with RIDECORE as the home screen: the web side goes back to the dash. */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent != null && Intent.ACTION_MAIN.equals(intent.getAction()) && intent.hasCategory(Intent.CATEGORY_HOME)) {
            notifyListeners("home", new JSObject());
        }
    }

    private static String iconDataUrl(Drawable drawable, int size) {
        if (drawable == null || size <= 0) return null;
        try {
            Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            drawable.setBounds(0, 0, size, size);
            drawable.draw(canvas);
            ByteArrayOutputStream png = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, png);
            bitmap.recycle();
            return "data:image/png;base64," + Base64.encodeToString(png.toByteArray(), Base64.NO_WRAP);
        } catch (RuntimeException e) {
            // An icon that won't draw: the drawer shows the app's initial instead.
            return null;
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

    /**
     * Android's status and navigation bars hidden: the whole screen is RIDECORE's. A swipe
     * in from the edge shows them for a moment, over the page, and they hide again by
     * themselves. Hidden again whenever RIDECORE comes back to the front.
     */
    private void fullScreen() {
        Activity activity = getActivity();
        if (activity == null) return;
        Window window = activity.getWindow();
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, window.getDecorView());
        bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        bars.hide(WindowInsetsCompat.Type.systemBars());
    }

    /**
     * Follows the camera's cut-out as the phone turns. From Android 15 the page is drawn
     * under it with the bars hidden, and older WebViews tell the page nothing of it. The
     * WebView still handles the insets itself, as before.
     */
    private void followCutout() {
        View page = bridge.getWebView();
        if (page == null) return;
        ViewCompat.setOnApplyWindowInsetsListener(page, (view, insets) -> {
            int kinds = WindowInsetsCompat.Type.displayCutout();
            // From Android 15 the page spans the bars too: should they ever stay, keep clear of them.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) kinds |= WindowInsetsCompat.Type.systemBars();
            JSObject next = sides(insets.getInsets(kinds), view.getResources().getDisplayMetrics().density);
            if (!next.toString().equals(cutout.toString())) {
                cutout = next;
                notifyListeners("cutout", next);
            }
            return ViewCompat.onApplyWindowInsets(view, insets);
        });
        ViewCompat.requestApplyInsets(page);
    }

    private static JSObject sides(Insets insets, float density) {
        JSObject sides = new JSObject();
        sides.put("top", Math.round(insets.top / density));
        sides.put("right", Math.round(insets.right / density));
        sides.put("bottom", Math.round(insets.bottom / density));
        sides.put("left", Math.round(insets.left / density));
        return sides;
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
