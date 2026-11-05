import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  createTripStop,
  formatDuration,
  formatKm,
  routeLibrary,
  searchPlaces,
  type GpsFix,
  type PlaceHit,
  type SavedRoute,
  type TripStop,
} from '../engine';
import { Sheet } from '../components/Sheet';
import { TrackThumb } from '../components/TrackThumb';

interface WhereToSheetProps {
  /** Results near here come first. */
  near: GpsFix | null;
  onPick: (stop: TripStop) => void;
  onRideTrip: (route: SavedRoute) => void;
  onClose: () => void;
}

/**
 * Where to ride: a saved trip in one tap, or search a place. Searching needs a
 * connection (OpenStreetMap's Nominatim); saved trips don't.
 */
export function WhereToSheet({ near, onPick, onRideTrip, onClose }: WhereToSheetProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [searched, setSearched] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trips, setTrips] = useState<SavedRoute[]>([]);
  const token = useRef(0);

  useEffect(() => {
    let live = true;
    routeLibrary
      .list()
      .then((list) => live && setTrips(list))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const asked = query.trim();
    if (asked.length < 2) return;
    // Only the latest search shows its results.
    const mine = ++token.current;
    setBusy(true);
    setError(null);
    try {
      const found = await searchPlaces(asked, near ? [near.longitude, near.latitude] : null);
      if (mine !== token.current) return;
      setHits(found);
      setSearched(asked);
    } catch (e) {
      if (mine === token.current) setError(e instanceof Error ? e.message : 'Search needs a connection');
    } finally {
      if (mine === token.current) setBusy(false);
    }
  };

  return (
    <Sheet title="Where to?" onClose={onClose} full>
      <form className="rc-search-form" onSubmit={(e) => void search(e)}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a place"
          enterKeyHint="search"
          aria-label="Place"
        />
        <button type="submit" className="rc-ctl rc-ctl-wide rc-ctl-go" disabled={busy || query.trim().length < 2}>
          {busy ? 'Searching' : 'Search'}
        </button>
      </form>
      {error ? <p className="rc-note" data-tone="error">{error}</p> : null}
      {hits && hits.length === 0 ? <p className="rc-note">Nothing found for “{searched}”</p> : null}
      {hits && hits.length > 0 ? (
        <ul className="rc-rows">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" className="rc-row" onClick={() => onPick(createTripStop('destination', hit.coordinate, hit.name, hit.subtitle))}>
                <span className="rc-row-text">
                  <b>{hit.name}</b>
                  {hit.subtitle ? <small>{hit.subtitle}</small> : null}
                </span>
                {hit.distanceMeters != null ? <em>{formatKm(hit.distanceMeters)}</em> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {trips.length > 0 ? (
        <>
          <h3 className="rc-section">Saved trips</h3>
          <ul className="rc-rows">
            {trips.map((route) => (
              <li key={route.id}>
                <button type="button" className="rc-row" onClick={() => onRideTrip(route)}>
                  <TrackThumb line={route.coordinates} />
                  <span className="rc-row-text">
                    <b>{route.name}</b>
                    <small>
                      {formatKm(route.distanceMeters)} · {formatDuration(route.durationSeconds)}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Sheet>
  );
}
