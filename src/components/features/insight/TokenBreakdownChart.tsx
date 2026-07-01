import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Layers } from 'lucide-react';
import { type Range, type AgentKey, AGENT_CONFIG, RANGES } from './constants';
import { fmtTokens } from './utils';
import type { AgentHeatmaps } from '@/services/tauri/insights';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-3 text-xs shadow-xl backdrop-blur-sm">
      <p className="mb-2 font-semibold text-slate-200">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.fill }} />
          <span className="capitalize text-slate-400 w-16">{p.dataKey}</span>
          <span className="font-mono text-slate-200">{fmtTokens(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function TokenBreakdownChart({ heatmaps, range }: { heatmaps: AgentHeatmaps; range: Range }) {
  const keys = (Object.keys(AGENT_CONFIG) as AgentKey[]).filter(k => !!heatmaps[k]);
  const data = keys.map(k => {
    const h = heatmaps[k]!;
    const { label, color } = AGENT_CONFIG[k];
    const ts = h.token_stats;
    return {
      name: label,
      input: ts.input_tokens,
      output: ts.output_tokens,
      cached: ts.cache_read_tokens,
      creation: ts.cache_creation_tokens,
      color,
    };
  });

  if (!data.length) return null;

  const rangeLabel = range === 'all' ? 'All time' : `Last ${RANGES.find(r => r.value === range)?.label}`;

  const LEGEND = [
    { key: 'input',    label: 'Input',         opacity: 0.95 },
    { key: 'output',   label: 'Output',        opacity: 0.6  },
    { key: 'cached',   label: 'Cache Read',    opacity: 0.35 },
    { key: 'creation', label: 'Cache Created', opacity: 0.2  },
  ];

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">Token Breakdown</h3>
        </div>
        <span className="text-xs text-slate-500">{rangeLabel}</span>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} barSize={32} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmtTokens}
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="input" stackId="a">
            {data.map(d => <Cell key={d.name} fill={d.color} fillOpacity={0.95} />)}
          </Bar>
          <Bar dataKey="output" stackId="a">
            {data.map(d => <Cell key={d.name} fill={d.color} fillOpacity={0.55} />)}
          </Bar>
          <Bar dataKey="cached" stackId="a">
            {data.map(d => <Cell key={d.name} fill={d.color} fillOpacity={0.32} />)}
          </Bar>
          <Bar dataKey="creation" stackId="a" radius={[4, 4, 0, 0]}>
            {data.map(d => <Cell key={d.name} fill={d.color} fillOpacity={0.18} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-600">
        {LEGEND.map(l => (
          <span key={l.key} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-400" style={{ opacity: l.opacity }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
