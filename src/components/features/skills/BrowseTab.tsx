import {
  CheckCircle,
  Clock,
  Download,
  Flame,
  Loader2,
  Package,
  Plus,
  SearchX,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  fetchMarketLeaderboard,
  installFromMarket,
  linkSkillToAgent,
  type MarketSkillItem,
  type SkillGroupsConfig,
  type SkillScope,
  searchMarketSkills,
} from '@/services';
import { useWorkspaceStore } from '@/stores';
import { type BoardType, leaderboardCache, searchCache } from './browseCache';

const BOARD_TABS: { value: BoardType; label: string; icon: React.ReactNode }[] = [
  { value: 'alltime', label: 'All Time', icon: <Clock className="h-3 w-3" /> },
  { value: 'trending', label: 'Trending', icon: <TrendingUp className="h-3 w-3" /> },
  { value: 'hot', label: 'Hot', icon: <Flame className="h-3 w-3" /> },
];

export type { BoardType };

function sourceLabel(source: string): string {
  try {
    const url = new URL(source);
    const parts = url.pathname.replace(/^\//, '').split('/');
    return parts[0] ?? source;
  } catch {
    return source;
  }
}

const DEFAULT_GROUP_NAME = 'Default';

export function BrowseTab({
  searchQuery,
  scope,
  installedIds,
  onInstalled,
  groupsConfig,
  onGroupsChange,
  selectedGroupId,
}: {
  searchQuery: string;
  scope: SkillScope;
  installedIds: Set<string>;
  onInstalled: () => void;
  groupsConfig: SkillGroupsConfig;
  onGroupsChange: (config: SkillGroupsConfig) => Promise<void>;
  selectedGroupId: string | null;
}) {
  const { cwd, selectedAgent } = useWorkspaceStore();
  const [board, setBoard] = useState<BoardType>('alltime');
  const [skills, setSkills] = useState<MarketSkillItem[]>(() => leaderboardCache['alltime'] ?? []);
  const [loading, setLoading] = useState(!leaderboardCache['alltime']);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadLeaderboard = useCallback(async (b: BoardType) => {
    if (leaderboardCache[b]) {
      setSkills(leaderboardCache[b]!);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchMarketLeaderboard(b);
      leaderboardCache[b] = data;
      setSkills(data);
    } catch (err) {
      toast.error('Failed to load marketplace', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!searchQuery) void loadLeaderboard(board);
  }, [board, loadLeaderboard, searchQuery]);

  useEffect(() => {
    if (!searchQuery) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const cached = searchCache.get(searchQuery);
      if (cached) {
        setSkills(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await searchMarketSkills(searchQuery, 40);
        searchCache.set(searchQuery, data);
        setSkills(data);
      } catch (err) {
        toast.error('Search failed', {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const sources = useMemo(() => Array.from(new Set(skills.map((s) => s.source))).sort(), [skills]);
  const filteredSkills = useMemo(
    () => (selectedSource ? skills.filter((s) => s.source === selectedSource) : skills),
    [skills, selectedSource]
  );

  const handleInstall = async (skill: MarketSkillItem) => {
    if (installingId) return;
    setInstallingId(skill.id);
    try {
      await installFromMarket(skill.source, skill.skillId, scope, cwd ?? undefined);

      // Link to currently selected agent
      await linkSkillToAgent(skill.name, selectedAgent, scope, cwd ?? undefined);

      // Add to target group: selectedGroupId if set, otherwise find/create Default if not in any group
      const groups = groupsConfig.groups;
      let targetId = selectedGroupId;
      let updatedGroups = groups;

      if (!targetId) {
        // If not specific group selected, check if skill already in some group
        const isAssigned = groups.some((g) => g.skillNames.includes(skill.name));
        if (!isAssigned) {
          const existing = groups.find((g) => g.name === DEFAULT_GROUP_NAME);
          if (existing) {
            targetId = existing.id;
          } else {
            targetId = uuidv4();
            updatedGroups = [...groups, { id: targetId, name: DEFAULT_GROUP_NAME, skillNames: [] }];
          }
        }
      }

      if (targetId) {
        await onGroupsChange({
          groups: updatedGroups.map((g) =>
            g.id === targetId && !g.skillNames.includes(skill.name)
              ? { ...g, skillNames: [...g.skillNames, skill.name] }
              : g
          ),
        });
      }

      onInstalled();
      toast.success(`Installed ${skill.name}`);
    } catch (err) {
      toast.error(`Failed to install ${skill.name}`, {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setInstallingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Board tabs */}
      {!searchQuery && (
        <div className="flex gap-1">
          {BOARD_TABS.map((t) => (
            <Button
              key={t.value}
              variant="ghost"
              size="sm"
              onClick={() => setBoard(t.value)}
              className={cn(
                'h-7 gap-1.5 px-3 text-xs',
                board === t.value
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.icon}
              {t.label}
            </Button>
          ))}
        </div>
      )}

      {/* Source filter chips – single scrollable row */}
      {sources.length > 1 && !loading && (
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedSource(null)}
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
              !selectedSource
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-muted text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
            )}
          >
            All
          </button>
          {sources.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => setSelectedSource(src === selectedSource ? null : src)}
              className={cn(
                'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-mono transition-colors',
                selectedSource === src
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-muted text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
              )}
            >
              {sourceLabel(src)}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin" />
          <p className="mt-3 text-sm">{searchQuery ? 'Searching…' : 'Loading…'}</p>
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4">
            <SearchX className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-semibold">
            {searchQuery ? `No results for "${searchQuery}"` : 'No skills found'}
          </h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
          {filteredSkills.map((skill) => {
            const installed = installedIds.has(skill.name);
            return (
              <div
                key={skill.id}
                className="group flex flex-col justify-between gap-3 rounded-lg border border-muted/60 bg-card/50 p-4 transition-all hover:border-primary/30 hover:shadow-md hover:bg-card"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-md bg-muted/50 p-2 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary shrink-0">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 justify-between">
                      <span className="truncate text-sm font-bold tracking-tight">
                        {skill.name}
                      </span>
                      {installed ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                          <CheckCircle className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <Button
                          size="icon"
                          variant="default"
                          className="h-7 w-7 shrink-0"
                          disabled={Boolean(installingId)}
                          onClick={() => void handleInstall(skill)}
                        >
                          {installingId === skill.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedSource(skill.source === selectedSource ? null : skill.source)
                      }
                      className={cn(
                        'inline-block max-w-full truncate rounded px-1.5 py-px text-[10px] font-mono transition-colors',
                        selectedSource === skill.source
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {sourceLabel(skill.source)}
                    </button>
                    {skill.installs > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                        <Download className="h-3 w-3" />
                        <span>{skill.installs.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
