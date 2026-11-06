import {
  formatArrivalTime,
  formatDuration,
  formatKm,
  mapService,
  navigationService,
  ROUTING_PROFILES,
  type RouteOptions,
  type SavedRoute,
} from '../engine';
import type { RideCoreState } from '../app/useRideCore';
import { CloseIcon } from './Icons';
import { Toggle } from './Toggle';

interface RoutePanelProps {
  core: RideCoreState;
  /** Offered from the saved trips: it rides as it was saved, so there are no options to change. */
  savedTrip: SavedRoute | null;
  options: RouteOptions;
  onOptions: (options: RouteOptions) => void;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

/**
 * Choosing a route, before the ride: where to, the routes on offer and Start, with how
 * they're planned a scroll further down. The grey line says how, so the options can wait.
 */
export function RoutePanel({ core, savedTrip, options, onOptions, onStart, onCancel, onRetry }: RoutePanelProps) {
  const { nav, trip, now } = core;
  const routes = nav.status === 'choosing' ? (nav.alternatives ?? []) : [];
  const selected = nav.selectedAlternativeIndex ?? 0;
  const offered = routes[selected];
  const percent = nav.status === 'planning' ? nav.progress?.percent : null;
  const how = savedTrip
    ? 'Saved trip'
    : `${ROUTING_PROFILES.find((profile) => profile.id === options.profile)?.label ?? 'Fastest'} · ${options.expressways ? 'expressways' : 'no expressways'}`;

  let text: string;
  if (nav.status === 'planning') {
    text = `${nav.message ?? 'Planning…'}${percent != null ? ` · ${Math.round(percent)}%` : ''}`;
  } else if (nav.status === 'error') {
    text = nav.message ?? 'No route found';
  } else if (offered) {
    text = `Arrive ${formatArrivalTime(now + offered.durationSeconds * 1000)} · ${how}`;
  } else {
    text = how;
  }

  const change = (next: Partial<RouteOptions>) => onOptions({ ...options, ...next });

  return (
    <div className="rc-plan" data-status={nav.status}>
      <div className="rc-plan-head">
        <div className="rc-plan-copy">
          <p className="rc-plan-title">{savedTrip?.name ?? trip.destination?.name ?? 'Route'}</p>
          <p className="rc-plan-text" data-tone={nav.status === 'error' ? 'error' : undefined}>
            {text}
          </p>
        </div>
        <button type="button" className="rc-plan-close" aria-label="Cancel" onClick={onCancel}>
          <CloseIcon />
        </button>
      </div>

      <div className="rc-plan-body">
        {nav.status === 'planning' ? (
          <span className="rc-plan-progress" data-known={percent != null ? 'true' : undefined} style={{ ['--p' as string]: (percent ?? 0) / 100 }}>
            <i />
          </span>
        ) : null}

        {routes.length > 0 ? (
          <div className="rc-routes" role="radiogroup" aria-label="Routes">
            {routes.map((route, index) => (
              <button
                key={route.id ?? index}
                type="button"
                role="radio"
                aria-checked={index === selected}
                className="rc-route"
                onClick={() => navigationService.selectAlternative(index)}
              >
                <i style={{ background: mapService.alternativeColor(index) }} aria-hidden />
                <b>{formatDuration(route.durationSeconds)}</b>
                <span>{formatKm(route.distanceMeters)}</span>
              </button>
            ))}
          </div>
        ) : null}

        {nav.status === 'choosing' ? (
          <button type="button" className="rc-btn rc-btn-wide" data-tone="go" onClick={onStart} disabled={!offered}>
            Start
          </button>
        ) : null}
        {nav.status === 'error' ? (
          <button type="button" className="rc-btn rc-btn-wide" data-tone="go" onClick={onRetry}>
            Try again
          </button>
        ) : null}

        {savedTrip ? null : (
          <>
            <h3 className="rc-section">How to route</h3>
            <div className="rc-seg" role="radiogroup" aria-label="Route type">
              {ROUTING_PROFILES.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  role="radio"
                  aria-checked={options.profile === profile.id}
                  title={profile.description}
                  onClick={() => options.profile !== profile.id && change({ profile: profile.id })}
                >
                  {profile.label}
                </button>
              ))}
            </div>
            <div className="rc-tile rc-settings">
              <Toggle
                label="Expressways"
                hint={options.expressways ? 'Most ban two-wheelers in India' : 'Kept off the route'}
                on={options.expressways}
                onChange={(on) => change({ expressways: on })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
