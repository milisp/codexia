import { motion } from 'framer-motion';
import { Search, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';

interface ToolListProps {
  tools: { tool_name: string; count: number }[];
  color: string;
  title?: string;
}

export function ToolList({ tools, color, title = 'Tool Usage' }: ToolListProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? tools.filter((t) => t.tool_name.toLowerCase().includes(q)) : tools;
    return list.slice().sort((a, b) => b.count - a.count);
  }, [tools, search]);

  const maxCount = tools[0]?.count ?? 1;

  if (tools.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
        <p className="text-xs text-slate-500 text-center py-2">No tool data</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
            {tools.length}
          </span>
        </div>
        <div className="relative w-40">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-7 pl-6 text-xs bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
          />
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
        {filtered.length === 0 && (
          <p className="py-3 text-center text-xs text-slate-500">No match</p>
        )}
        {filtered.map(({ tool_name, count }) => (
          <div key={tool_name} className="flex items-center gap-2">
            <span className="w-36 shrink-0 truncate font-mono text-xs text-slate-300">
              {tool_name}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(count / maxCount) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-xs text-slate-400">
              {count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
