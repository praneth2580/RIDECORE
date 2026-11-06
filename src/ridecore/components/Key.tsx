import type { ReactNode } from 'react';

interface KeyProps {
  icon: ReactNode;
  /** A word or two. */
  label: string;
  /** Where it's at, in a word: On, Off, ×1, a count. */
  state?: string;
  /** Lit when on. Left out for a key that does something instead (opens, goes). */
  on?: boolean;
  /** A setting with a few values, tapped through in turn: how many, and which is set. */
  steps?: { count: number; at: number };
  onClick: () => void;
}

/**
 * A key on the device: one big square to tap, gloves and all. An icon, a word, and its
 * state; lit lime when on. Replaces a phone app's rows of switches and explanations.
 */
export function Key({ icon, label, state, on, steps, onClick }: KeyProps) {
  return (
    <button
      type="button"
      className="rc-key"
      role={on === undefined ? undefined : 'switch'}
      aria-checked={on}
      data-on={on || steps ? 'true' : undefined}
      onClick={onClick}
    >
      <span className="rc-key-icon">{icon}</span>
      <span className="rc-key-text">
        <b>{label}</b>
        {state ? <small>{state}</small> : null}
      </span>
      {steps ? (
        <span className="rc-key-steps" aria-hidden>
          {Array.from({ length: steps.count }, (_, index) => (
            <i key={index} data-on={index <= steps.at ? 'true' : undefined} />
          ))}
        </span>
      ) : null}
    </button>
  );
}
