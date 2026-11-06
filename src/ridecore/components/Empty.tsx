import type { ReactNode } from 'react';

/** Nothing here yet: a big quiet icon, a few words, and how it fills. */
export function Empty({ icon, title, text }: { icon?: ReactNode; title: string; text: string }) {
  return (
    <div className="rc-empty">
      {icon ? <span className="rc-empty-icon">{icon}</span> : null}
      <p className="rc-empty-title">{title}</p>
      <p className="rc-empty-text">{text}</p>
    </div>
  );
}
