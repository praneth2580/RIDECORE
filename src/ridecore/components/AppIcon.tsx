import type { PhoneApp } from '../device';

/** An app's own icon, or its first letter when the icon wouldn't draw. */
export function AppIcon({ app }: { app: PhoneApp }) {
  return app.icon ? <img src={app.icon} alt="" draggable={false} /> : <i aria-hidden>{app.label.slice(0, 1)}</i>;
}
