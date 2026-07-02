import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AGENTS_MAX_DEPTH_CAP, AGENTS_MAX_THREADS_CAP, useSettingsStore } from '@/stores/settings';

/**
 * Settings panel for multi-agent runtime limits.
 * Mirrors the `[agents]` TOML section that Codex reads from ~/.codex/config.toml.
 * Product caps: max_threads ≤ 12, max_depth ≤ 4.
 */
export function SettingsAgentsSection() {
  const { agentsMaxThreads, agentsMaxDepth, setAgentsMaxThreads, setAgentsMaxDepth } =
    useSettingsStore();

  const handleThreadsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) setAgentsMaxThreads(val);
  };

  const handleDepthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) setAgentsMaxDepth(val);
  };

  return (
    <div className="w-full px-2 sm:px-4 space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm sm:text-base font-medium">Multi-agent</h3>
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* max_threads */}
          <div className="flex items-center justify-between gap-3 rounded-md border p-3 sm:p-4">
            <div className="space-y-0.5 flex-1 min-w-0">
              <Label className="text-xs sm:text-sm font-medium">Thread limit</Label>
              <p className="text-xs text-muted-foreground">
                Maximum number of concurrent sub-agent threads (1–{AGENTS_MAX_THREADS_CAP}).
                Injected as <code className="text-xs">agents.max_threads</code> at thread start.
              </p>
            </div>
            <Input
              type="number"
              min={1}
              max={AGENTS_MAX_THREADS_CAP}
              value={agentsMaxThreads}
              onChange={handleThreadsChange}
              className="w-20 text-right"
            />
          </div>

          {/* max_depth */}
          <div className="flex items-center justify-between gap-3 rounded-md border p-3 sm:p-4">
            <div className="space-y-0.5 flex-1 min-w-0">
              <Label className="text-xs sm:text-sm font-medium">Spawn depth</Label>
              <p className="text-xs text-muted-foreground">
                How many levels deep agents may spawn child agents (1–{AGENTS_MAX_DEPTH_CAP}).
                Injected as <code className="text-xs">agents.max_depth</code> at thread start.
              </p>
            </div>
            <Input
              type="number"
              min={1}
              max={AGENTS_MAX_DEPTH_CAP}
              value={agentsMaxDepth}
              onChange={handleDepthChange}
              className="w-20 text-right"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
