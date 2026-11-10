import type { ReactNode } from 'react';

interface PageProps {
  /** Small, at the top, like a watch screen's name. */
  title: string;
  /** A line under it: the state of things. */
  sub?: string;
  /** "live" lights the line red (recording). */
  subTone?: 'live';
  /** Under the title, staying put when the page is filled: a search field. */
  top?: ReactNode;
  /** Exactly one screen, what it holds scrolling inside it instead of on to the next page. */
  fill?: boolean;
  /**
   * A screen pulled over the dash (settings from above, the apps from below): a handle
   * on the edge toward the dash. It isn't part of the list, so a swipe on it always goes
   * back, however long the list is; a tap does too. Labelled with where it goes: the
   * dash, unless the screen is further out than that (all apps, past the picked ones).
   */
  handle?: { edge: 'top' | 'bottom'; label?: string; onBack: () => void };
  children: ReactNode;
}

/**
 * One screen of the device after the dash: its name small and centred at the top, as a
 * watch's or a car's screens have it, then what it holds, using the whole width.
 */
export function Page({ title, sub, subTone, top, fill, handle, children }: PageProps) {
  const grip = handle ? (
    <button type="button" className="rc-handle" data-edge={handle.edge} onClick={handle.onBack}>
      <i aria-hidden />
      <span>{handle.label ?? 'Dash'}</span>
    </button>
  ) : null;
  return (
    <section className="rc-page" data-fill={fill ? 'true' : undefined} data-handle={handle?.edge} aria-label={title}>
      {handle?.edge === 'top' ? grip : null}
      <header className="rc-page-head">
        <h2>{title}</h2>
        {sub ? <p data-tone={subTone}>{sub}</p> : null}
        {top}
      </header>
      <div className="rc-page-body">{children}</div>
      {handle?.edge === 'bottom' ? grip : null}
    </section>
  );
}
