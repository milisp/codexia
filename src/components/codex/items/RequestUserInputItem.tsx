import { useMemo, useState } from 'react';
import { useRequestUserInputStore } from '@/components/codex/stores';
import { useConfigStore } from '@/components/codex/stores/useConfigStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { codexService } from '@/services/codexService';

type RequestUserInputItemProps = {
  currentThreadId: string | null;
};

export function RequestUserInputItem({ currentThreadId }: RequestUserInputItemProps) {
  const { pendingRequests, respondToRequest } = useRequestUserInputStore();
  const { setCollaborationMode } = useConfigStore();

  const currentRequest = useMemo(
    () => pendingRequests.find((request) => request.threadId === currentThreadId) ?? null,
    [pendingRequests, currentThreadId]
  );

  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    if (!currentRequest) return {};
    const initial: Record<string, string> = {};
    currentRequest.questions.forEach((question) => {
      initial[question.id] = '';
    });
    return initial;
  });

  const [otherAnswers, setOtherAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!currentRequest) {
    return null;
  }

  const hasMissingAnswer = (
    nextAnswers: Record<string, string>,
    nextOtherAnswers: Record<string, string>
  ) =>
    currentRequest.questions.some((question) => {
      const value = nextAnswers[question.id];
      if (!value) {
        return true;
      }
      if (value === '__other__') {
        return !nextOtherAnswers[question.id]?.trim();
      }
      return false;
    });

  const missingAnswer = hasMissingAnswer(answers, otherAnswers);

  const handleSubmit = async (
    nextAnswers: Record<string, string> = answers,
    nextOtherAnswers: Record<string, string> = otherAnswers
  ) => {
    if (hasMissingAnswer(nextAnswers, nextOtherAnswers) || submitting) return;
    setSubmitting(true);
    try {
      const response = {
        answers: Object.fromEntries(
          currentRequest.questions.map((question) => {
            const selected = nextAnswers[question.id];
            const resolved =
              selected === '__other__' ? nextOtherAnswers[question.id]?.trim() : selected;
            return [question.id, { answers: [resolved ?? ''] }];
          })
        ),
      };
      await respondToRequest(currentRequest.requestId, response);

      if (currentRequest.threadId) {
        setCollaborationMode('default');
        await codexService.turnStart(currentRequest.threadId, 'Implement the plan and patch.', []);
      }
    } catch (error) {
      console.error('Failed to submit request_user_input response:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-md border bg-background p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">request_user_input</Badge>
        <span className="font-medium">Input Required</span>
        {pendingRequests.length > 1 && (
          <Badge variant="secondary">{pendingRequests.length} pending</Badge>
        )}
      </div>

      <div className="space-y-4">
        {currentRequest.questions.map((question) => {
          const value = answers[question.id] ?? '';
          const showOther = value === '__other__';
          const options = question.options ?? [];
          const hasOptions = options.length > 0;

          return (
            <div key={question.id} className="space-y-2">
              <Label className="text-sm font-medium">{question.header || 'Question'}</Label>
              <div className="text-sm text-muted-foreground">{question.question}</div>

              {hasOptions ? (
                <div className="space-y-2">
                  <Select
                    value={value}
                    onValueChange={(nextValue) => {
                      const nextAnswers = { ...answers, [question.id]: nextValue };
                      const nextOtherAnswers =
                        nextValue !== '__other__'
                          ? { ...otherAnswers, [question.id]: '' }
                          : otherAnswers;

                      setAnswers(nextAnswers);
                      if (nextValue !== '__other__') {
                        setOtherAnswers(nextOtherAnswers);
                      }

                      if (
                        nextValue !== '__other__' &&
                        !hasMissingAnswer(nextAnswers, nextOtherAnswers)
                      ) {
                        void handleSubmit(nextAnswers, nextOtherAnswers);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem key={option.label} value={option.label}>
                          <div className="flex flex-col gap-0.5">
                            <span>{option.label}</span>
                            {option.description && (
                              <span className="text-[10px] text-muted-foreground">
                                {option.description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                      {question.isOther && <SelectItem value="__other__">Other…</SelectItem>}
                    </SelectContent>
                  </Select>
                  {showOther && (
                    <Textarea
                      value={otherAnswers[question.id] ?? ''}
                      onChange={(event) =>
                        setOtherAnswers((prev) => ({
                          ...prev,
                          [question.id]: event.target.value,
                        }))
                      }
                      placeholder="Enter your answer"
                      className="min-h-[80px]"
                    />
                  )}
                </div>
              ) : (
                <Textarea
                  value={value}
                  onChange={(event) =>
                    setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))
                  }
                  placeholder="Enter your answer"
                  className="min-h-[80px]"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={() => void handleSubmit()} disabled={missingAnswer || submitting}>
          Submit
        </Button>
      </div>
    </div>
  );
}
