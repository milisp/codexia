export function ModelBadges({ models, color }: { models: string[]; color: string }) {
  if (!models.length) return <span className="text-xs text-slate-600 italic">unknown</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {models.map((m) => (
        <span
          key={m}
          className="rounded-full px-2 py-0.5 font-mono text-xs"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {m}
        </span>
      ))}
    </div>
  );
}
