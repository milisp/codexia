import { CircleCheck, LoaderCircle } from 'lucide-react';
import type { TurnPlanStep } from '@/bindings/v2';
import { cn } from '@/lib/utils';

interface TurnPlanProps {
  plan: TurnPlanStep[];
  explanation: string | null;
}

export function TurnPlan({ plan, explanation }: TurnPlanProps) {
  return (
    <div className="flex flex-col p-3 rounded-lg border border-border bg-card/50">
      {explanation && (
        <div className="text-sm text-foreground/80 font-medium mb-4 px-1">{explanation}</div>
      )}
      <div className="flex flex-col">
        {plan.map((p, index) => (
          <div key={index} className="flex items-start gap-2">
            {/* Status Icon Column */}
            <div className="flex flex-col items-center flex-shrink-0 w-6 py-0.5">
              <div className="relative w-5 h-5 flex items-center justify-center">
                {p.status === 'completed' ? (
                  <CircleCheck className="w-5 h-5 text-emerald-500" />
                ) : p.status === 'inProgress' ? (
                  <div className="relative w-5 h-5 flex items-center justify-center">
                    <LoaderCircle
                      className="absolute inset-0 w-5 h-5 text-blue-600 animate-spin"
                      strokeWidth={2.5}
                    />
                    <span className="text-[11px] font-bold text-blue-600 z-10">{index + 1}</span>
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-muted-foreground/40 flex items-center justify-center bg-muted/10">
                    <span className="text-[11px] font-bold text-muted-foreground/60">
                      {index + 1}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Text Content Column */}
            <div
              className={cn(
                'flex-1 transition-all duration-300',
                index < plan.length - 1 ? 'pb-5' : 'pb-1'
              )}
            >
              <h4
                className={cn(
                  'text-[13px] font-medium leading-snug pt-0.5',
                  p.status === 'completed' &&
                    'text-muted-foreground line-through decoration-muted-foreground/30',
                  p.status === 'inProgress' && 'text-foreground font-semibold',
                  p.status === 'pending' && 'text-muted-foreground/80'
                )}
              >
                {p.step}
              </h4>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
