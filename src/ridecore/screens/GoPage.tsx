import { useCallback, useEffect, useImperativeHandle, useRef, useState, type FormEvent, type MouseEvent, type Ref } from 'react';
import {
  formatDuration,
  formatKm,
  routeLibrary,
  searchPlaces,
  type GpsFix,
  type PlaceHit,
  type SavedRoute,
  type TripStop,
} from '../engine';
import { Empty } from '../components/Empty';
import { Key } from '../components/Key';
import { Page } from '../components/Page';
import { CloseIcon, PinIcon, RecentIcon, SearchIcon } from '../components/Icons';
import { TrackThumb } from '../components/TrackThumb';
import { forgetPlace, loadRecentPlaces, rememberPlace, stopFor, type RecentPlace } from '../recent';

export interface GoPageHandle {
  /** Closes the search: the field emptied, the results gone, the pages free again. */
  clear(): void;
}

interface GoPageProps {
  /** Results near here come first. */
  near: GpsFix | null;
  /**
   * Searching, from the tap in the field until the search is closed. The page then holds
   * still (the pager keeps to it) and its results scroll inside it, so reaching the end
   * of them never carries on to the next page.
   */
  searching: boolean;
  onSearching: (searching: boolean) => void;
  /** In view: the saved trips are read again, in case one was added. */
  active: boolean;
  /** Changes to put the cursor in the search, as "Where to?" on the dash does. */
  focusSearch: number;
  onPick: (stop: TripStop) => void;
  onRideTrip: (route: SavedRoute) => void;
  ref?: Ref<GoPageHandle>;
}

/** The pager waits this long for the page to arrive before the keyboard opens. */
const FOCUS_AFTER_MS = 450;

/**
 * Where to ride. Typing on a mounted phone is slow, so what was ridden to before comes
 * first, one tap each: recent places as keys (hold one to forget it), saved trips as
 * cards. Or search a place (the keyboard's search key; OpenStreetMap's Nominatim, so it
 * needs a connection).
 */
export function GoPage({ near, searching, onSearching, active, focusSearch, onPick, onRideTrip, ref }: GoPageProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [searched, setSearched] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trips, setTrips] = useState<SavedRoute[]>([]);
  // Only this screen changes them, so they're read once.
  const [recent, setRecent] = useState<RecentPlace[]>(loadRecentPlaces);
  const token = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!active) return;
    let live = true;
    routeLibrary
      .list()
      .then((list) => live && setTrips(list))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [active]);

  useEffect(() => {
    if (focusSearch === 0) return;
    const id = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), FOCUS_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [focusSearch]);

  const clear = useCallback(() => {
    // A search still on its way is dropped.
    token.current += 1;
    setQuery('');
    setHits(null);
    setSearched('');
    setBusy(false);
    setError(null);
    inputRef.current?.blur();
    onSearching(false);
  }, [onSearching]);

  useImperativeHandle(ref, () => ({ clear }), [clear]);

  // Gone (a trip under way takes its place): no search left holding the pages.
  useEffect(() => () => onSearching(false), [onSearching]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const asked = query.trim();
    if (asked.length < 2) return;
    inputRef.current?.blur();
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

  const go = (place: RecentPlace) => {
    setRecent(rememberPlace(place));
    onPick(stopFor(place));
  };

  // A long press: Android's browser calls it a context menu.
  const forget = (event: MouseEvent, place: RecentPlace) => {
    event.preventDefault();
    setRecent(forgetPlace(place));
  };

  const field = (
    <form className="rc-search-form" onSubmit={(e) => void search(e)}>
      <label className="rc-search">
        <SearchIcon />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => onSearching(true)}
          placeholder="Search a place"
          enterKeyHint="search"
          aria-label="Place"
        />
      </label>
      {searching ? (
        <button type="button" className="rc-search-close" aria-label="Close search" onClick={clear}>
          <CloseIcon />
        </button>
      ) : null}
    </form>
  );

  return (
    <Page title="Where to" top={field} fill={searching}>
      {busy ? <p className="rc-note">Searching…</p> : null}
      {error ? <p className="rc-note" data-tone="error">{error}</p> : null}
      {!busy && hits && hits.length === 0 ? <p className="rc-note">Nothing found for “{searched}”</p> : null}
      {hits && hits.length > 0 ? (
        <ul className="rc-rows">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" className="rc-row" onClick={() => go({ name: hit.name, subtitle: hit.subtitle, coordinate: hit.coordinate })}>
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

      {!hits && recent.length > 0 ? (
        <>
          <h3 className="rc-section">Again</h3>
          <div className="rc-keys">
            {recent.map((place) => (
              <div key={`${place.name}@${place.coordinate.join(',')}`} className="rc-key-wrap" onContextMenu={(e) => forget(e, place)}>
                <Key icon={<RecentIcon />} label={place.name} state={place.subtitle?.split(',')[0]} onClick={() => go(place)} />
              </div>
            ))}
          </div>
        </>
      ) : null}

      {!hits && trips.length > 0 ? (
        <>
          <h3 className="rc-section">Saved trips</h3>
          <ul className="rc-cards">
            {trips.map((route) => (
              <li key={route.id}>
                <button type="button" className="rc-card" onClick={() => onRideTrip(route)}>
                  <TrackThumb line={route.coordinates} />
                  <b>{route.name}</b>
                  <small>
                    {formatKm(route.distanceMeters)} · {formatDuration(route.durationSeconds)}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {!hits && !searching && recent.length === 0 && trips.length === 0 ? (
        <Empty icon={<PinIcon />} title="Search a place" text="Places you ride to come here, one tap to go again." />
      ) : null}
    </Page>
  );
}
