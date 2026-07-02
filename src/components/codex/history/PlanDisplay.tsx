import { ArrowRight, CheckCircle, Circle } from 'lucide-react';

export type PlanStatus = 'pending' | 'in_progress' | 'completed';

export interface SimplePlanStep {
  step: string;
  status: PlanStatus;
}

export interface PlanDisplayProps {
  title?: string;
  steps: SimplePlanStep[];
  currentStep?: number;
  className?: string;
}

export function PlanDisplay({ steps, currentStep, className = '' }: PlanDisplayProps) {
  // If currentStep not provided, infer from first in_progress
  const inferredCurrent =
    typeof currentStep === 'number'
      ? currentStep
      : steps.findIndex((s) => s.status === 'in_progress');

  const getStepIcon = (step: SimplePlanStep, index: number) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <ArrowRight className="w-4 h-4 text-blue-500" />;
      default:
        return (
          <Circle
            className={`w-4 h-4 ${index === inferredCurrent ? 'text-blue-500' : 'text-gray-400'}`}
          />
        );
    }
  };

  const getStepColor = (step: SimplePlanStep, index: number) => {
    switch (step.status) {
      case 'completed':
        return 'text-green-700 dark:text-green-300';
      case 'in_progress':
        return 'text-blue-700 dark:text-blue-300 font-medium';
      default:
        return index === inferredCurrent
          ? 'text-blue-700 dark:text-blue-300'
          : 'text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div
      className={`plan-display bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg px-2 ${className}`}
    >
      {/* Steps */}
      <div>
        {steps.map((step, index) => (
          <div
            key={`${index}-${step.step}`}
            className={`flex items-start gap-3 p-1 rounded-md transition-colors ${
              index === inferredCurrent
                ? 'bg-orange-100 dark:bg-orange-800/30'
                : 'hover:bg-orange-50 dark:hover:bg-orange-900/10'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">{getStepIcon(step, index)}</div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm ${getStepColor(step, index)}`}>
                <span className="font-medium">{index + 1}.</span> {step.step}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
