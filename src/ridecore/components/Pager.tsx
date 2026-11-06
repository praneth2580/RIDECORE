import { Children, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';

export interface PagerHandle {
  /** Scrolls to a page: smoothly, unless told otherwise. */
  show(index: number, smooth?: boolean): void;
}

interface PagerProps {
  /** One page each. */
  children: ReactNode;
  /** x: side by side, swiped left and right. y: stacked, swiped up and down. */
  axis: 'x' | 'y';
  /** The page it starts on and comes back to. */
  home?: number;
  /**
   * Held on this page, with no swiping to the others (where-to while searching). Null
   * lets the pages go.
   */
  hold: number | null;
  /** Held, with the other pages gone (the map taking the screen). */
  solo?: boolean;
  /** The page in view changed. */
  onPage: (index: number) => void;
  /** Back home after this long untouched on another page. */
  returnAfterMs: number;
  /** Just before going back home on its own. */
  onReturn?: () => void;
  ref?: Ref<PagerHandle>;
}

/**
 * Screens laid out like a watch's: swiped through one at a time, each snapping into
 * place, dots for where you are. Two of these make the device: one sideways, and one
 * up and down inside its first page. Left alone, it goes back home.
 */
export function Pager({ children, axis, home = 0, hold, solo = false, onPage, returnAfterMs, onReturn, ref }: PagerProps) {
  const pages = Children.toArray(children);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(home);
  const currentRef = useRef(home);
  const holdRef = useRef(hold);
  const onPageRef = useRef(onPage);
  const onReturnRef = useRef(onReturn);
  const x = axis === 'x';

  useEffect(() => {
    onPageRef.current = onPage;
    onReturnRef.current = onReturn;
    holdRef.current = hold;
  });

  const offsetOf = useCallback(
    (index: number) => {
      const page = scrollerRef.current?.children[index];
      if (!(page instanceof HTMLElement)) return null;
      return x ? page.offsetLeft : page.offsetTop;
    },
    [x],
  );

  const show = useCallback(
    (index: number, smooth = true) => {
      const scroller = scrollerRef.current;
      const offset = offsetOf(index);
      if (!scroller || offset == null) return;
      scroller.scrollTo({ [x ? 'left' : 'top']: offset, behavior: smooth ? 'smooth' : 'instant' });
    },
    [offsetOf, x],
  );

  useImperativeHandle(ref, () => ({ show }), [show]);

  // Starts at home, before the first frame shows.
  useLayoutEffect(() => {
    show(home, false);
  }, [home, show]);

  // The page in view: the last one starting before the middle of the screen.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      let index = holdRef.current ?? 0;
      if (holdRef.current == null) {
        const middle = x ? scroller.scrollLeft + scroller.clientWidth / 2 : scroller.scrollTop + scroller.clientHeight / 2;
        Array.from(scroller.children).forEach((child, i) => {
          if (child instanceof HTMLElement && (x ? child.offsetLeft : child.offsetTop) <= middle) index = i;
        });
      }
      if (index === currentRef.current) return;
      currentRef.current = index;
      setCurrent(index);
      onPageRef.current(index);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [x]);

  // Held: on that page at once, and kept there when the screen changes size (the
  // keyboard coming up shrinks it, the phone turning swaps it round).
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || hold == null) return;
    const pin = () => {
      const offset = offsetOf(hold);
      if (offset == null) return;
      if (x) scroller.scrollLeft = offset;
      else scroller.scrollTop = offset;
    };
    pin();
    const observer = new ResizeObserver(pin);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [hold, solo, offsetOf, x]);

  // Like a watch going back to its face. Not while typing a search, nor while the map
  // has the screen. Capturing: a list scrolling inside a page counts as a touch too.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || solo) return;
    let timer = 0;
    const wait = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.activeElement instanceof HTMLInputElement) wait();
        else if (currentRef.current !== home) {
          onReturnRef.current?.();
          show(home);
        }
      }, returnAfterMs);
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'focusin'] as const;
    for (const event of events) scroller.addEventListener(event, wait, { capture: true, passive: true });
    wait();
    return () => {
      window.clearTimeout(timer);
      for (const event of events) scroller.removeEventListener(event, wait, { capture: true });
    };
  }, [solo, home, returnAfterMs, show]);

  return (
    <div className="rc-pager" data-axis={axis} data-hold={hold ?? undefined} data-solo={solo && hold != null ? hold : undefined}>
      <div ref={scrollerRef} className="rc-pager-pages">
        {pages}
      </div>
      {hold != null ? null : (
        <ol className="rc-pager-dots" aria-hidden>
          {pages.map((_, index) => (
            <li key={index} data-on={index === current ? 'true' : undefined} />
          ))}
        </ol>
      )}
    </div>
  );
}
