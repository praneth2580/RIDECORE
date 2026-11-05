/** A tile saying a list is empty, and how it fills. */
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rc-tile rc-empty">
      <p className="rc-tile-big">{title}</p>
      <p className="rc-tile-sub">{text}</p>
    </div>
  );
}
