import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { useGitStatsStore } from '@/stores/useGitStatsStore';
import type { DiffSection } from './types';

type GitStatsIndicatorProps = {
  diffSection?: DiffSection;
};

export function GitStatsIndicator({ diffSection }: GitStatsIndicatorProps) {
  const { stats } = useGitStatsStore();

  if (!stats) return null;

  const isStaged = diffSection === 'staged';
  const additions = isStaged ? stats.stagedAdditions : stats.unstagedAdditions;
  const deletions = isStaged ? stats.stagedDeletions : stats.unstagedDeletions;

  return (
    <div className="flex items-center text-xs">
      <Badge
        variant="outline"
        className="gap-1 border-transparent bg-transparent px-0 py-0 font-mono tabular-nums"
      >
        <span className="flex items-center gap-0.5 text-emerald-400">
          +<AnimatedCount value={additions} />
        </span>
        <span className="flex items-center gap-0.5 text-red-400">
          -<AnimatedCount value={deletions} />
        </span>
      </Badge>
    </div>
  );
}

function AnimatedCount({ value }: { value: number }) {
  return (
    <span className="inline-grid min-w-[1ch]">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
