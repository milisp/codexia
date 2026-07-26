import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, RefreshCw, Settings2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type AgentHeatmaps,
  type FilterOptions,
  getAgentHeatmaps,
  getInsightFilterOptions,
  getInsightRankings,
  type Rankings,
} from '@/services/tauri/insights';
import { AgentPanel } from './AgentPanel';
import { AGENT_CONFIG, type AgentKey, type ModelPricing, RANGES, type Range } from './constants';
import { OverviewTab } from './OverviewTab';
import { PricingEditor } from './PricingEditor';
import { RankingsTab } from './RankingsTab';
import { ErrorState, LoadingState } from './States';
import { loadPricing, savePricing } from './utils';

export default function InsightsView() {
  const [data, setData] = useState<AgentHeatmaps | null>(null);
  const [rankings, setRankings] = useState<Rankings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('month');
  const [pricing, setPricing] = useState<Record<string, ModelPricing>>(loadPricing);
  const [showPricing, setShowPricing] = useState(false);

  // filters
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ cwds: [], session_ids: [] });
  const [selectedCwd, setSelectedCwd] = useState<string | null>(null);

  useEffect(() => {
    getInsightFilterOptions()
      .then(setFilterOptions)
      .catch(() => {});
  }, []);

  const load = useCallback(async (r: Range, cwd: string | null) => {
    setLoading(true);
    setError(null);
    const filters = {
      range: r === 'all' ? undefined : r,
      cwd: cwd ?? undefined,
    };
    try {
      const [heatmaps, ranks] = await Promise.all([
        getAgentHeatmaps(filters),
        getInsightRankings(filters),
      ]);
      setData(heatmaps);
      setRankings(ranks);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range, selectedCwd);
  }, [range, selectedCwd, load]);

  function handleSavePricing(p: Record<string, ModelPricing>) {
    savePricing(p);
    setPricing(p);
  }

  const agentTabs = data ? (Object.keys(AGENT_CONFIG) as AgentKey[]).filter((k) => !!data[k]) : [];

  const hasFilters = !!selectedCwd;

  return (
    <div className="h-full overflow-auto bg-slate-950 p-5">
      {/* ── header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-4 flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-violet-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Agent Insights
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">Usage across Claude · Codex · Gemini</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/60 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  range === r.value
                    ? 'bg-slate-700 text-slate-100 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-slate-200"
            onClick={() => setShowPricing(true)}
            title="Edit model pricing"
          >
            <Settings2 className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-slate-200"
            onClick={() => load(range, selectedCwd)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      {/* ── filter bar ── */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        {/* cwd filter */}
        {filterOptions.cwds.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  selectedCwd
                    ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="max-w-[160px] truncate">
                  {selectedCwd ? selectedCwd.split('/').slice(-2).join('/') : 'CWD'}
                </span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-60 overflow-auto bg-slate-900 border-slate-800 text-xs"
            >
              <DropdownMenuItem
                className="text-slate-400 focus:text-slate-100"
                onSelect={() => setSelectedCwd(null)}
              >
                All directories
              </DropdownMenuItem>
              {filterOptions.cwds.map((c) => (
                <DropdownMenuItem
                  key={c}
                  className={`font-mono focus:text-slate-100 ${
                    selectedCwd === c ? 'text-violet-300' : 'text-slate-300'
                  }`}
                  onSelect={() => setSelectedCwd(selectedCwd === c ? null : c)}
                >
                  {c}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {hasFilters && (
          <button
            onClick={() => {
              setSelectedCwd(null);
            }}
            className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear filters
          </button>
        )}
      </motion.div>

      {/* ── content ── */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={() => load(range, selectedCwd)} />
      ) : data ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${range}-${selectedCwd}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="bg-slate-900/60 border border-slate-800">
                <TabsTrigger
                  value="overview"
                  className="text-xs text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100"
                >
                  Overview
                </TabsTrigger>
                {agentTabs.map((k) => (
                  <TabsTrigger
                    key={k}
                    value={k}
                    className="text-xs capitalize text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100"
                  >
                    {AGENT_CONFIG[k].icon}
                  </TabsTrigger>
                ))}
                <TabsTrigger
                  value="rankings"
                  className="text-xs text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100"
                >
                  Top Usage
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
                <OverviewTab heatmaps={data} range={range} pricing={pricing} />
              </TabsContent>

              {agentTabs.map((k) => (
                <TabsContent key={k} value={k} className="mt-0 focus-visible:outline-none">
                  <AgentPanel agentKey={k} data={data[k]!} range={range} pricing={pricing} />
                </TabsContent>
              ))}

              <TabsContent value="rankings" className="mt-0 focus-visible:outline-none">
                {rankings ? <RankingsTab rankings={rankings} /> : <LoadingState />}
              </TabsContent>
            </Tabs>
          </motion.div>
        </AnimatePresence>
      ) : null}

      <AnimatePresence>
        {showPricing && (
          <PricingEditor
            pricing={pricing}
            onSave={handleSavePricing}
            onClose={() => setShowPricing(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
