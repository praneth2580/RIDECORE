import { PICKS_MAX, pickedApps, type PhoneApps } from '../apps';
import type { PhoneApp } from '../device';
import { AppIcon } from '../components/AppIcon';
import { Empty } from '../components/Empty';
import { GridIcon } from '../components/Icons';
import { Page } from '../components/Page';

interface AllAppsPageProps {
  phone: PhoneApps;
  onOpen: (app: PhoneApp) => void;
  /** Held: on to the Apps screen, or off it. */
  onHold: (app: PhoneApp) => void;
  /** Back down to the Apps screen, the way in. */
  onBack: () => void;
}

/**
 * Every app on the phone, A to Z: a home screen's app drawer, a swipe up past the
 * picked apps. Holding one puts it on the Apps screen (up to its eight) or takes it
 * off; the ones on it are marked.
 */
export function AllAppsPage({ phone, onOpen, onHold, onBack }: AllAppsPageProps) {
  const { supported, apps, picks } = phone;
  const count = pickedApps(apps ?? [], picks).length;
  return (
    <Page
      title="All apps"
      fill
      handle={{ edge: 'top', label: 'Apps', onBack }}
      top={
        supported && apps && apps.length > 0 ? (
          <p className="rc-apps-count">
            Hold an app to put it on Apps · <b>{count}</b> of {PICKS_MAX}
          </p>
        ) : null
      }
    >
      {!supported ? (
        <Empty icon={<GridIcon />} title="On the phone only" text="As the phone's home screen, RIDECORE lists its apps here to open them." />
      ) : !apps ? (
        <p className="rc-note">Loading apps…</p>
      ) : apps.length === 0 ? (
        <Empty icon={<GridIcon />} title="No apps" text="Nothing else on this phone opens from a home screen." />
      ) : (
        <ul className="rc-apps">
          {apps.map((app) => (
            <li key={`${app.packageName}/${app.activity ?? ''}`}>
              <button
                type="button"
                className="rc-app"
                data-picked={picks.includes(app.packageName) ? 'true' : undefined}
                onClick={() => onOpen(app)}
                onContextMenu={(event) => {
                  // A long press: Android's browser calls it a context menu.
                  event.preventDefault();
                  onHold(app);
                }}
              >
                <AppIcon app={app} />
                <span>{app.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
