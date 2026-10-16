import { useTranslation } from 'react-i18next';
import type { TurnPlanStep } from '@/bindings/v2';
import { Plan, type PlanStepData } from '@/components/ai-elements/Plan';
import { Markdown } from '@/components/Markdown';

const STEP_STATUS: Record<TurnPlanStep['status'], PlanStepData['status']> = {
  completed: 'done',
  inProgress: 'running',
  pending: 'pending',
};

interface TurnPlanProps {
  plan: TurnPlanStep[];
  explanation: string | null;
}

/** The agent's step list from `turn/plan/updated`. */
export function TurnPlan({ plan, explanation }: TurnPlanProps) {
  const { t } = useTranslation('thread');
  const done = plan.filter((step) => step.status === 'completed').length;
  const running = plan.some((step) => step.status === 'inProgress');

  return (
    <Plan
      title={t('plan.label')}
      description={t('items.planProgress', { done, total: plan.length })}
      steps={plan.map((step) => ({ title: step.step, status: STEP_STATUS[step.status] }))}
      running={running}
    >
      {explanation ? <p className="mt-2">{explanation}</p> : null}
    </Plan>
  );
}

/** A free-form plan item (`plan` thread item) rendered as Markdown. */
export function PlanTextItem({ text }: { text: string }) {
  const { t } = useTranslation('thread');
  if (!text.trim()) return null;

  return (
    <Plan title={t('plan.label')}>
      <Markdown value={text} />
    </Plan>
  );
}
