import type { ReactNode } from 'react';
import { BackIcon, CloseIcon } from './Icons';

interface SheetProps {
  title: string;
  onClose: () => void;
  /** Shows a back button, for pages inside a sheet. */
  onBack?: () => void;
  /** Takes the whole screen (lists), instead of rising from the bottom (choices). */
  full?: boolean;
  children: ReactNode;
}

/** Everything that isn't the device's main screen opens in one of these, over it. */
export function Sheet({ title, onClose, onBack, full, children }: SheetProps) {
  return (
    <div className="rc-sheet-backdrop" data-full={full ? 'true' : undefined} onClick={onClose}>
      <div className="rc-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="rc-sheet-head">
          {onBack ? (
            <button type="button" className="rc-ctl rc-ctl-small" aria-label="Back" onClick={onBack}>
              <BackIcon />
            </button>
          ) : null}
          <h2>{title}</h2>
          <button type="button" className="rc-ctl rc-ctl-small" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="rc-sheet-body">{children}</div>
      </div>
    </div>
  );
}
