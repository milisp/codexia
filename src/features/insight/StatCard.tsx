import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: ReactNode;
}

export function StatCard({ label, value, sub, color, icon }: StatCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-slate-900/60 p-4 transition-colors hover:bg-slate-900/80"
      style={{ borderColor: `${color}28` }}
    >
      {/* subtle glow */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl"
        style={{ backgroundColor: `${color}18` }}
      />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-100 truncate">{value}</p>
          {sub && <p className="mt-0.5 text-[11px] text-slate-500 truncate">{sub}</p>}
        </div>
        <div
          className="ml-3 shrink-0 rounded-lg p-2"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
