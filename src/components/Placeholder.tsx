export default function Placeholder({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-content">{title}</h1>
      <p className="mt-2 text-sm text-muted">{blurb}</p>
      <div className="mt-6 rounded-lg border border-dashed border-line bg-surface p-10 text-center text-sm text-faint">
        Coming in a later phase.
      </div>
    </div>
  );
}
