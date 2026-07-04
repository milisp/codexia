import { CheckCircle2, MessageCircleQuestion } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ccSendMessage } from '@/services';
import { useCCStore } from '@/stores/cc';
import type { ToolUseBlock } from '../../../types/messages';

interface QuestionOption {
  label: string;
  value: string;
}

interface Question {
  question: string;
  multiSelect: boolean;
  options: QuestionOption[];
  annotations?: Record<string, unknown>;
}

interface AskUserQuestionInput {
  questions: Question[];
  metadata?: Record<string, unknown>;
}

interface Props {
  block: ToolUseBlock;
}

interface QuestionAnswer {
  selected: string[];
}

export function AskUserQuestionCard({ block }: Props) {
  const input = block.input as AskUserQuestionInput;
  const questions = input?.questions ?? [];

  const { activeSessionId, addMessage, setLoading } = useCCStore();

  // Track selected options per question index
  const [answers, setAnswers] = useState<QuestionAnswer[]>(() =>
    questions.map(() => ({ selected: [] }))
  );
  const [submitted, setSubmitted] = useState<string[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleOption = (qIdx: number, value: string, multiSelect: boolean) => {
    if (submitted) return;
    setAnswers((prev) => {
      const next = [...prev];
      if (multiSelect) {
        const cur = next[qIdx].selected;
        next[qIdx] = {
          selected: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
        };
      } else {
        next[qIdx] = { selected: [value] };
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!activeSessionId || isSubmitting) return;

    // Build response: for each question, collect selected option labels
    const responseLines = questions
      .map((q, i) => {
        const sel = answers[i].selected;
        if (sel.length === 0) return null;
        const labels = q.options.filter((o) => sel.includes(o.value)).map((o) => o.label);
        return labels.join(', ');
      })
      .filter(Boolean) as string[];

    if (responseLines.length === 0) return;

    const responseText = responseLines.join('\n');
    setSubmitted(responseLines);
    setIsSubmitting(true);

    try {
      addMessage({ type: 'user', text: responseText });
      setLoading(true);
      await ccSendMessage(activeSessionId, responseText);
    } catch (err) {
      console.error('[AskUserQuestionCard] Failed to send answer:', err);
      setSubmitted(null);
      setLoading(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs font-medium">Answered</span>
        </div>
        {submitted.map((ans, i) => (
          <div key={i} className="text-xs text-foreground/80 pl-5">
            {ans}
          </div>
        ))}
      </div>
    );
  }

  const allAnswered = answers.every((a) => a.selected.length > 0);

  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-3">
      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
        <MessageCircleQuestion className="w-3.5 h-3.5 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide">Question</span>
      </div>

      {questions.map((q, qIdx) => (
        <div key={qIdx} className="space-y-2">
          <p className="text-sm text-foreground">{q.question}</p>

          <div className="flex flex-col gap-1.5">
            {q.options.map((opt) => {
              const isSelected = answers[qIdx].selected.includes(opt.value);
              if (q.multiSelect) {
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer transition-colors
                      ${isSelected
                        ? 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                        : 'border-border hover:border-blue-500/30 hover:bg-blue-500/5'
                      }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOption(qIdx, opt.value, true)}
                    />
                    {opt.label}
                  </label>
                );
              }
              return (
                <Button
                  key={opt.value}
                  variant="outline"
                  size="sm"
                  className={`justify-start h-auto py-2 px-3 text-sm font-normal transition-colors
                    ${isSelected
                      ? 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/15'
                      : 'hover:border-blue-500/30 hover:bg-blue-500/5'
                    }`}
                  onClick={() => toggleOption(qIdx, opt.value, false)}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </div>
      ))}

      {questions.length > 0 && (
        <Button
          size="sm"
          className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-white"
          disabled={!allAnswered || isSubmitting}
          onClick={handleSubmit}
        >
          Submit
        </Button>
      )}
    </div>
  );
}
