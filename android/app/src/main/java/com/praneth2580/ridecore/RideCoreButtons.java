package com.praneth2580.ridecore;

import android.os.Handler;
import android.os.Looper;

/**
 * The module's five buttons as presses: a tap when let go quickly, a hold once kept down
 * HOLD_MS (fired while still held, so the rider feels it take). Here rather than in the
 * page, because the page's timers slow to a crawl behind another app (the incoming call
 * screen), and that's exactly when a button has to answer. The web side's simulator does
 * the same in src/ridecore/module/buttons.ts.
 */
final class RideCoreButtons {

    interface Listener {
        /** On the main thread. */
        void onPress(int button, boolean hold);
    }

    /** In the order the firmware numbers them. */
    static final String[] NAMES = {"up", "down", "left", "right", "ok"};
    static final int OK = 4;
    static final long HOLD_MS = 600;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable[] holdTimers = new Runnable[NAMES.length];
    private final boolean[] held = new boolean[NAMES.length];
    private final Listener listener;

    RideCoreButtons(Listener listener) {
        this.listener = listener;
    }

    /** A debounced edge from the module; any thread. */
    void edge(int button, boolean down) {
        if (button < 0 || button >= NAMES.length) return;
        handler.post(() -> {
            if (down) {
                cancel(button);
                held[button] = false;
                Runnable timer = () -> {
                    holdTimers[button] = null;
                    held[button] = true;
                    listener.onPress(button, true);
                };
                holdTimers[button] = timer;
                handler.postDelayed(timer, HOLD_MS);
                return;
            }
            // Up: a tap, unless it was held (that press is done).
            boolean pending = holdTimers[button] != null;
            cancel(button);
            if (pending && !held[button]) listener.onPress(button, false);
            held[button] = false;
        });
    }

    /** Unplugged mid-press: nothing fires late. */
    void reset() {
        handler.post(() -> {
            for (int i = 0; i < NAMES.length; i++) {
                cancel(i);
                held[i] = false;
            }
        });
    }

    private void cancel(int button) {
        Runnable timer = holdTimers[button];
        if (timer != null) handler.removeCallbacks(timer);
        holdTimers[button] = null;
    }
}
