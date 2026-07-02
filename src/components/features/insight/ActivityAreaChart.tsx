import { eachDayOfInterval, format, subDays } from 'date-fns';
import { TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AgentHeatmaps } from '@/services/tauri/insights';
import { AGENT_CONFIG, type AgentKey, type Range } from './constants';
import { weeksForRange } from './utils';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const nonZero = payload.filter((p: any) => p.value > 0);
  if (!nonZero.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-2.5 text-xs shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 text-slate-400">{label}</p>
      {nonZero.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.stroke }} />
          <span className="capitalize text-slate-300">{p.dataKey}</span>
          <span className="ml-auto pl-3 font-mono font-semibold text-slate-100">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function ActivityAreaChart({ heatmaps, range }: { heatmaps: AgentHeatmaps; range: Range }) {
  const weeks = weeksForRange(range);
  const today = new Date();
  const startDate = subDays(today, weeks * 7 - 1);

  const { chartData, activeKeys } = useMemo(() => {
    const keys = (Object.keys(AGENT_CONFIG) as AgentKey[]).filter((k) => !!heatmaps[k]);
    const maps = {} as Record<AgentKey, Map<string, number>>;
    for (const key of keys) {
      maps[key] = new Map();
      for (const d of heatmaps[key]!.data) maps[key].set(d.date, d.count);
    }
    const days = eachDayOfInterval({ start: startDate, end: today });
    const data = days.map((day) => {
      const ds = format(day, 'yyyy-MM-dd');
      const entry: Record<string, any> = { date: format(day, 'MMM d') };
      for (const key of keys) entry[key] = maps[key].get(ds) ?? 0;
      return entry;
    });
    return { chartData: data, activeKeys: keys };
  }, [heatmaps, weeks, startDate]);

  const tickInterval = Math.max(1, Math.floor(chartData.length / 7));

  if (!activeKeys.length) return null;

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">Activity Trend</h3>
        </div>
        <div className="flex items-center gap-3">
          {activeKeys.map((k) => (
            <div key={k} className="flex items-center gap-1.5 text-xs text-slate-500">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: AGENT_CONFIG[k].color }}
              />
              {AGENT_CONFIG[k].label}
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
          <defs>
            {activeKeys.map((k) => (
              <linearGradient key={k} id={`act-grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={AGENT_CONFIG[k].color} stopOpacity={0.28} />
                <stop offset="95%" stopColor={AGENT_CONFIG[k].color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.035)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#475569', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={tickInterval - 1}
          />
          <YAxis
            tick={{ fill: '#475569', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={26}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'rgba(255,255,255,0.07)', strokeWidth: 1 }}
          />
          {activeKeys.map((k) => (
            <Area
              key={k}
              type="monotone"
              dataKey={k}
              stroke={AGENT_CONFIG[k].color}
              strokeWidth={1.5}
              fill={`url(#act-grad-${k})`}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: AGENT_CONFIG[k].color }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
