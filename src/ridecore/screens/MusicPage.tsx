import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { device } from '../device';
import { Key } from '../components/Key';
import { MusicIcon, NextIcon, PauseIcon, PlayIcon, PreviousIcon, RadioIcon, StarIcon } from '../components/Icons';
import { Page } from '../components/Page';
import { canSkip, playStation, skip, togglePlay, useNowPlaying, usePhoneMedia, useRadio } from '../media';
import { fetchStations, loadFavourites, radioCountry, toggleFavourite, type RadioStation } from '../radio';

interface MusicPageProps {
  /** In view: the stations are read the first time. */
  active: boolean;
  onNote: (message: string, tone: 'info' | 'error') => void;
}

/** Read once a run: the most played stations don't change by the minute. */
let stationsRead: RadioStation[] | null = null;

/**
 * Music on the ride, a swipe right of the dash: what plays, from any of the phone's apps
 * or RIDECORE's radio, with big keys to play, pause and skip; then radio stations,
 * favourites first (star one; hold its key to unstar it).
 */
export function MusicPage({ active, onNote }: MusicPageProps) {
  const phone = usePhoneMedia();
  const radioState = useRadio();
  const now = useNowPlaying();
  const [favourites, setFavourites] = useState(loadFavourites);
  const [stations, setStations] = useState<RadioStation[] | null>(stationsRead);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active || stations || error) return;
    let live = true;
    const country = radioCountry(Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.languages);
    fetchStations(country)
      .then((list) => {
        stationsRead = list;
        if (live) setStations(list);
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Radio stations need a connection'));
    return () => {
      live = false;
    };
  }, [active, stations, error, attempt]);

  const star = (station: RadioStation) => {
    const next = toggleFavourite(station);
    setFavourites(next);
    onNote(next.some((s) => s.id === station.id) ? `${station.name} added to favourites` : `${station.name} taken off favourites`, 'info');
  };

  // A long press: Android's browser calls it a context menu.
  const unstar = (event: MouseEvent, station: RadioStation) => {
    event.preventDefault();
    star(station);
  };

  const playingId = radioState.station && (radioState.status === 'playing' || radioState.status === 'loading') ? radioState.station.id : null;
  const nothing = !now && !phone.supported;
  const hint = now
    ? now.loading
      ? 'Tuning in…'
      : (now.error ?? now.subtitle)
    : phone.supported
      ? 'Play music in any app, or a station below'
      : 'Pick a radio station below';

  const openSource = () => {
    if (now?.source === 'phone' && phone.packageName) void device.openApp({ packageName: phone.packageName }).catch(() => undefined);
  };

  return (
    <Page title="Music" fill>
      <div className="rc-music">
        <section className="rc-player" aria-label="Playing">
          <button type="button" className="rc-player-now" onClick={openSource} disabled={now?.source !== 'phone'}>
            <span className="rc-player-art" data-source={now?.source}>
              {now?.art ? <Logo key={now.art} src={now.art} /> : now?.source === 'radio' ? <RadioIcon /> : <MusicIcon />}
            </span>
            <span className="rc-player-text">
              <b>{now ? now.title : 'Nothing playing'}</b>
              <small data-tone={now?.error ? 'error' : undefined}>{hint}</small>
            </span>
          </button>
          <div className="rc-transport">
            <button type="button" aria-label="Back" disabled={nothing || !canSkip(now)} onClick={() => skip(now, 'previous')}>
              <PreviousIcon />
            </button>
            <button
              type="button"
              className="rc-transport-play"
              aria-label={now?.playing || now?.loading ? 'Pause' : 'Play'}
              disabled={nothing}
              onClick={() => togglePlay(now)}
            >
              {now?.playing || now?.loading ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button type="button" aria-label="Next" disabled={nothing || !canSkip(now)} onClick={() => skip(now, 'next')}>
              <NextIcon />
            </button>
          </div>
          {phone.supported && !phone.access ? (
            <div className="rc-keys rc-player-access">
              <Key icon={<MusicIcon />} label="Show what plays" state="Allow in Android" onClick={() => void device.openMediaAccess()} />
            </div>
          ) : null}
        </section>

        <section className="rc-music-radio" aria-label="Radio">
          {favourites.length > 0 ? (
            <>
              <h3 className="rc-section">Favourite stations</h3>
              <div className="rc-keys">
                {favourites.map((station) => (
                  <div key={station.id} className="rc-key-wrap" onContextMenu={(e) => unstar(e, station)}>
                    <Key
                      icon={station.favicon ? <Logo src={station.favicon} fallback={<RadioIcon />} /> : <RadioIcon />}
                      label={station.name}
                      state={playingId === station.id ? (radioState.status === 'loading' ? 'Tuning in…' : 'Playing') : (station.tags ?? 'Radio')}
                      on={playingId === station.id}
                      onClick={() => (playingId === station.id ? togglePlay(now) : playStation(station, favourites))}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <h3 className="rc-section">Radio</h3>
          {error ? (
            <div className="rc-keys">
              <Key icon={<RadioIcon />} label="Try again" state={error} onClick={() => {
                setError(null);
                setAttempt((n) => n + 1);
              }} />
            </div>
          ) : !stations ? (
            <p className="rc-note">Finding stations…</p>
          ) : stations.length === 0 ? (
            <p className="rc-note">No stations found</p>
          ) : (
            <ul className="rc-rows">
              {stations.map((station) => {
                const starred = favourites.some((s) => s.id === station.id);
                return (
                  <li key={station.id} className="rc-station" data-on={playingId === station.id ? 'true' : undefined}>
                    <button type="button" className="rc-row" onClick={() => playStation(station, stations)}>
                      <span className="rc-station-logo">{station.favicon ? <Logo src={station.favicon} fallback={<RadioIcon />} /> : <RadioIcon />}</span>
                      <span className="rc-row-text">
                        <b>{station.name}</b>
                        {station.tags ? <small>{station.tags}</small> : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="rc-star"
                      aria-label={starred ? `Take ${station.name} off favourites` : `Add ${station.name} to favourites`}
                      aria-pressed={starred}
                      onClick={() => star(station)}
                    >
                      <StarIcon filled={starred} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
}

/** A cover or a station's logo; what's given instead if it won't load. */
function Logo({ src, fallback = null }: { src: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return <img src={src} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} />;
}
