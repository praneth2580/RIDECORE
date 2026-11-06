package com.praneth2580.ridecore;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Base64;
import android.view.KeyEvent;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * The music playing on the phone, from whichever app plays it: what it is (title, artist,
 * the app, the cover) and its controls. Seeing what plays needs notification access
 * (RideCoreMediaListener); without it the controls still work, as a headset's buttons do.
 */
final class RideCoreMedia {

    interface Listener {
        void onChange(JSObject media);
    }

    /** Covers are sent this many pixels across: sharp in the player, small over the bridge. */
    private static final int ART_PX = 256;

    private final Context context;
    private final Listener listener;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<MediaController> watched = new ArrayList<>();
    private MediaSessionManager sessions;
    private boolean listening = false;
    /** The cover sent last, by what it belongs to, so it's encoded once a song. */
    private String artKey = null;
    private String artUrl = null;

    private final MediaController.Callback onControllerChange = new MediaController.Callback() {
        @Override
        public void onPlaybackStateChanged(PlaybackState state) {
            emit();
        }

        @Override
        public void onMetadataChanged(MediaMetadata metadata) {
            emit();
        }

        @Override
        public void onSessionDestroyed() {
            refresh();
        }
    };

    private final MediaSessionManager.OnActiveSessionsChangedListener onSessionsChange = controllers -> watch(controllers);

    RideCoreMedia(Context context, Listener listener) {
        this.context = context.getApplicationContext();
        this.listener = listener;
    }

    boolean hasAccess() {
        return NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.getPackageName());
    }

    ComponentName listenerComponent() {
        return new ComponentName(context, RideCoreMediaListener.class);
    }

    /** Starts following the phone's sessions once access is given; safe to call again. */
    void start() {
        if (listening || !hasAccess()) return;
        sessions = (MediaSessionManager) context.getSystemService(Context.MEDIA_SESSION_SERVICE);
        if (sessions == null) return;
        try {
            sessions.addOnActiveSessionsChangedListener(onSessionsChange, listenerComponent(), main);
            listening = true;
            watch(sessions.getActiveSessions(listenerComponent()));
        } catch (SecurityException e) {
            // Access taken away between the check and the call.
            listening = false;
        }
    }

    void stop() {
        if (sessions != null && listening) sessions.removeOnActiveSessionsChangedListener(onSessionsChange);
        listening = false;
        unwatch();
    }

    private void refresh() {
        if (!listening || sessions == null) return;
        try {
            watch(sessions.getActiveSessions(listenerComponent()));
        } catch (SecurityException e) {
            stop();
            emit();
        }
    }

    private void watch(List<MediaController> controllers) {
        unwatch();
        if (controllers != null) {
            for (MediaController controller : controllers) {
                controller.registerCallback(onControllerChange, main);
                watched.add(controller);
            }
        }
        emit();
    }

    private void unwatch() {
        for (MediaController controller : watched) controller.unregisterCallback(onControllerChange);
        watched.clear();
    }

    /** The one to show: the first playing, else the most recent. */
    private MediaController current() {
        for (MediaController controller : watched) {
            PlaybackState state = controller.getPlaybackState();
            if (state != null && state.getState() == PlaybackState.STATE_PLAYING) return controller;
        }
        return watched.isEmpty() ? null : watched.get(0);
    }

    private void emit() {
        listener.onChange(snapshot());
    }

    JSObject snapshot() {
        JSObject media = new JSObject();
        media.put("supported", true);
        media.put("access", hasAccess());
        MediaController controller = listening ? current() : null;
        MediaMetadata metadata = controller != null ? controller.getMetadata() : null;
        media.put("active", metadata != null);
        PlaybackState state = controller != null ? controller.getPlaybackState() : null;
        media.put("playing", state != null && state.getState() == PlaybackState.STATE_PLAYING);
        if (controller == null || metadata == null) return media;

        String packageName = controller.getPackageName();
        String title = text(metadata, MediaMetadata.METADATA_KEY_TITLE, MediaMetadata.METADATA_KEY_DISPLAY_TITLE);
        String artist = text(metadata, MediaMetadata.METADATA_KEY_ARTIST, MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, MediaMetadata.METADATA_KEY_ALBUM_ARTIST);
        media.put("packageName", packageName);
        media.put("app", appLabel(packageName));
        if (title != null) media.put("title", title);
        if (artist != null) media.put("artist", artist);
        String art = art(metadata, packageName + "|" + title + "|" + artist);
        if (art != null) media.put("art", art);
        return media;
    }

    /**
     * play, pause, toggle, next or previous. To the session being shown when there is one,
     * else as a media button, which the app playing last takes.
     */
    boolean control(String action) {
        MediaController controller = listening ? current() : null;
        if (controller != null) {
            MediaController.TransportControls controls = controller.getTransportControls();
            PlaybackState state = controller.getPlaybackState();
            boolean playing = state != null && state.getState() == PlaybackState.STATE_PLAYING;
            switch (action) {
                case "play": controls.play(); return true;
                case "pause": controls.pause(); return true;
                case "toggle": if (playing) controls.pause(); else controls.play(); return true;
                case "next": controls.skipToNext(); return true;
                case "previous": controls.skipToPrevious(); return true;
                default: return false;
            }
        }
        int code;
        switch (action) {
            case "play": code = KeyEvent.KEYCODE_MEDIA_PLAY; break;
            case "pause": code = KeyEvent.KEYCODE_MEDIA_PAUSE; break;
            case "toggle": code = KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE; break;
            case "next": code = KeyEvent.KEYCODE_MEDIA_NEXT; break;
            case "previous": code = KeyEvent.KEYCODE_MEDIA_PREVIOUS; break;
            default: return false;
        }
        AudioManager audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (audio == null) return false;
        long now = SystemClock.uptimeMillis();
        audio.dispatchMediaKeyEvent(new KeyEvent(now, now, KeyEvent.ACTION_DOWN, code, 0));
        audio.dispatchMediaKeyEvent(new KeyEvent(now, now, KeyEvent.ACTION_UP, code, 0));
        return true;
    }

    private static String text(MediaMetadata metadata, String... keys) {
        for (String key : keys) {
            CharSequence value = metadata.getText(key);
            if (value != null && value.length() > 0) return value.toString();
        }
        return null;
    }

    private String appLabel(String packageName) {
        try {
            PackageManager pm = context.getPackageManager();
            return String.valueOf(pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)));
        } catch (PackageManager.NameNotFoundException e) {
            return null;
        }
    }

    private String art(MediaMetadata metadata, String key) {
        if (key.equals(artKey)) return artUrl;
        Bitmap bitmap = null;
        for (String name : new String[] {
            MediaMetadata.METADATA_KEY_ALBUM_ART, MediaMetadata.METADATA_KEY_ART, MediaMetadata.METADATA_KEY_DISPLAY_ICON,
        }) {
            bitmap = metadata.getBitmap(name);
            if (bitmap != null) break;
        }
        String url = null;
        if (bitmap != null) {
            try {
                float scale = Math.min(1f, (float) ART_PX / Math.max(bitmap.getWidth(), bitmap.getHeight()));
                Bitmap small = Bitmap.createScaledBitmap(
                    bitmap,
                    Math.max(1, Math.round(bitmap.getWidth() * scale)),
                    Math.max(1, Math.round(bitmap.getHeight() * scale)),
                    true
                );
                ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
                small.compress(Bitmap.CompressFormat.JPEG, 82, jpeg);
                url = "data:image/jpeg;base64," + Base64.encodeToString(jpeg.toByteArray(), Base64.NO_WRAP);
            } catch (RuntimeException e) {
                url = null;
            }
        }
        artKey = key;
        artUrl = url;
        return url;
    }
}
