import { PICKS_MAX, pickedApps, type PhoneApps } from '../apps';
import type { PhoneApp } from '../device';
import { AppIcon } from '../components/AppIcon';
import { Empty } from '../components/Empty';
import { GridIcon } from '../components/Icons';
import { Page } from '../components/Page';

interface AppsPageProps {
  phone: PhoneApps;
  onOpen: (app: PhoneApp) => void;
  /** Held: taken off this screen. */
  onHold: (app: PhoneApp) => void;
  /** On to every app, the drawer a swipe further up. */
  onAll: () => void;
  /** Back down to the dash, from the handle at the top. */
  onBack: () => void;
}

/**
 * The apps a ride needs (music, calls, messages…), a swipe up from the dash: the few
 * the rider picked from all the phone's apps, as big keys to hit with gloves on. Every
 * app is a swipe further, where holding one puts it here.
 */
export function AppsPage({ phone, onOpen, onHold, onAll, onBack }: AppsPageProps) {
  const { supported, apps } = phone;
  const picked = pickedApps(apps ?? [], phone.picks);
  return (
    <Page title="Apps" fill handle={{ edge: 'top', onBack }}>
      {!supported ? (
        <Empty icon={<GridIcon />} title="On the phone only" text="As the phone's home screen, RIDECORE lists its apps here to open them." />
      ) : !apps ? (
        <p className="rc-note">Loading apps…</p>
      ) : (
        <div className="rc-picks-screen">
          <ul className="rc-picks">
            {picked.map((app) => (
              <li key={app.packageName}>
                <button
                  type="button"
                  className="rc-pick"
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
            {picked.length < PICKS_MAX ? (
              <li>
                <button type="button" className="rc-pick" data-add="true" onClick={onAll}>
                  <i aria-hidden>
                    <GridIcon />
                  </i>
                  <span>All apps</span>
                </button>
              </li>
            ) : null}
          </ul>
          <p className="rc-note" data-center>
            {picked.length > 0
              ? 'Swipe up for all apps. Hold one here to take it off'
              : `Swipe up for all apps, and hold the ones you ride with (up to ${PICKS_MAX}) to put them here`}
          </p>
        </div>
      )}
    </Page>
  );
}
