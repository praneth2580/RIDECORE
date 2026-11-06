import { device, type ScreenSides } from './device';

/**
 * The camera's cut-out, kept clear of. RIDECORE fills the whole screen with Android's
 * bars hidden, and from Android 15 that includes the corner of glass the camera sits in.
 * Newer WebViews report it as env(safe-area-inset-*); older ones report nothing, so the
 * phone's own measure goes into --rc-cut-*, and --rc-top/right/bottom/left take
 * whichever is larger (styles/ridecore.css).
 */

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

/** The CSS variables for a cut-out: whole pixels, never below 0, a side left out as 0. */
export function cutoutVars(cutout: Partial<ScreenSides> | null | undefined): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const side of SIDES) {
    const value = Number(cutout?.[side]);
    vars[`--rc-cut-${side}`] = `${Number.isFinite(value) && value > 0 ? Math.round(value) : 0}px`;
  }
  return vars;
}

interface StyleRoot {
  style: Pick<CSSStyleDeclaration, 'setProperty'>;
}

/** Keeps --rc-cut-* on the page up to date as the phone turns; the returned function stops it. */
export function followCutout(root: StyleRoot = document.documentElement): () => void {
  let heard = false;
  const apply = (cutout: Partial<ScreenSides>) => {
    for (const [name, value] of Object.entries(cutoutVars(cutout))) root.style.setProperty(name, value);
  };
  void device.getCutout().then(
    // A turn reported meanwhile is newer than this answer.
    (cutout) => heard || apply(cutout),
    () => undefined,
  );
  const changes = device.addListener('cutout', (cutout) => {
    heard = true;
    apply(cutout);
  });
  return () => void changes.then((listener) => listener.remove());
}
