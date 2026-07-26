import { subDays as _subDays, eachDayOfInterval, format } from 'date-fns';
import { useMemo, useState } from 'react';
import type { HeatmapData } from '@/services/tauri/insights';
import type { Range } from './constants';
import { weeksForRange } from './utils';

const CELL = 10;
const GAP = 2;

interface HeatmapProps {
  data: HeatmapData;
  color: string;
  range: Range;
}

export function ContributionHeatmap({ data, color, range }: HeatmapProps) {
  const weeks = weeksForRange(range);
  const today = new Date();
  const startDate = _subDays(today, weeks * 7 - 1);

  const activityMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of data.data) m.set(d.date, d.count);
    return m;
  }, [data.data]);

  const days = eachDayOfInterval({ start: startDate, end: today });
  const paddedDays: (Date | null)[] = [];
  const offset = (startDate.getDay() + 6) % 7;
  for (let i = 0; i < offset; i++) paddedDays.push(null);
  paddedDays.push(...days);

  const grid: (Date | null)[][] = [];
  for (let i = 0; i < paddedDays.length; i += 7) grid.push(paddedDays.slice(i, i + 7));

  const maxCount = Math.max(1, ...data.data.map((d) => d.count));

  function opacity(count: number): number {
    if (!count) return 0;
    const r = count / maxCount;
    if (r < 0.25) return 0.25;
    if (r < 0.5) return 0.45;
    if (r < 0.75) return 0.65;
    return 0.9;
  }

  const [tip, setTip] = useState<{ date: string; count: number; x: number; y: number } | null>(
    null
  );

  return (
    <div className="overflow-x-auto">
      <svg
        width={grid.length * (CELL + GAP)}
        height={7 * (CELL + GAP)}
        className="overflow-visible"
        onMouseLeave={() => setTip(null)}
      >
        {grid.map((week, wi) =>
          week.map((day, di) => {
            if (!day) return null;
            const ds = format(day, 'yyyy-MM-dd');
            const cnt = activityMap.get(ds) ?? 0;
            const x = wi * (CELL + GAP);
            const y = di * (CELL + GAP);
            return (
              <rect
                key={ds}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={2}
                fill={cnt ? color : 'rgb(30,32,40)'}
                fillOpacity={opacity(cnt)}
                className="cursor-pointer"
                onMouseEnter={() =>
                  setTip({
                    date: format(day, 'MMM d, yyyy'),
                    count: cnt,
                    x: x + CELL / 2,
                    y: y - 4,
                  })
                }
              />
            );
          })
        )}
        {tip && (
          <g>
            <rect
              x={tip.x - 54}
              y={tip.y - 30}
              width={108}
              height={26}
              rx={4}
              fill="rgb(15,17,23)"
              stroke="rgb(51,65,85)"
              strokeWidth={1}
            />
            <text x={tip.x} y={tip.y - 20} textAnchor="middle" fill="rgb(226,232,240)" fontSize={9}>
              {tip.date}
            </text>
            <text
              x={tip.x}
              y={tip.y - 9}
              textAnchor="middle"
              fill={color}
              fontSize={9}
              fontWeight="bold"
            >
              {tip.count} session{tip.count !== 1 ? 's' : ''}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
