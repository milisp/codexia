import { useTranslation } from 'react-i18next';
import { ChainOfThought } from '@/components/ai-elements/ChainOfThought';
import { Trace } from '@/components/ui/trace';
import { isStepFailed, type StepItem } from './stepItems';
import { ThreadStepItem } from './ThreadStepItem';

export interface StepEntry {
  item: StepItem;
  running: boolean;
}

interface ThreadStepChainProps {
  steps: StepEntry[];
}

/** Consecutive steps of one run: a single step stands alone, several collapse into a chain. */
export function ThreadStepChain({ steps }: ThreadStepChainProps) {
  const { t } = useTranslation('thread');

  if (steps.length === 0) return null;

  const rows = steps.map((step) => (
    <ThreadStepItem key={step.item.id} item={step.item} running={step.running} />
  ));

  if (steps.length === 1) return <Trace>{rows}</Trace>;

  const running = steps.some((step) => step.running);
  const failedCount = steps.filter((step) => !step.running && isStepFailed(step.item)).length;
  const title = running
    ? t('items.stepsRunning')
    : [
        t('items.stepsDone', { count: steps.length }),
        failedCount > 0 ? t('items.stepsFailed', { count: failedCount }) : null,
      ]
        .filter(Boolean)
        .join(', ');

  return (
    <ChainOfThought title={title} running={running} failed={failedCount > 0}>
      {rows}
    </ChainOfThought>
  );
}
