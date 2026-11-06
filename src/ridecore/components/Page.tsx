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
  children: ReactNode;
}

/**
 * One screen of the device after the dash: its name small and centred at the top, as a
 * watch's or a car's screens have it, then what it holds, using the whole width.
 */
export function Page({ title, sub, subTone, top, fill, children }: PageProps) {
  return (
    <section className="rc-page" data-fill={fill ? 'true' : undefined} aria-label={title}>
      <header className="rc-page-head">
        <h2>{title}</h2>
        {sub ? <p data-tone={subTone}>{sub}</p> : null}
        {top}
      </header>
      <div className="rc-page-body">{children}</div>
    </section>
  );
}
