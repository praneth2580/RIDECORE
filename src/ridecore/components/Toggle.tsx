interface ToggleProps {
  label: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
}

/** A setting that is on or off: a whole row to tap, with a switch at the end. */
export function Toggle({ label, hint, on, onChange }: ToggleProps) {
  return (
    <button type="button" role="switch" aria-checked={on} className="rc-toggle" onClick={() => onChange(!on)}>
      <span>
        <b>{label}</b>
        <small>{hint}</small>
      </span>
      <i aria-hidden />
    </button>
  );
}
