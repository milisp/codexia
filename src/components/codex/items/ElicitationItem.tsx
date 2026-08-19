import { useMemo, useState } from 'react';
import type { McpElicitationConstOption } from '@/bindings/v2';
import {
  type ElicitationField,
  type ElicitationRequest,
  elicitationChoices,
  elicitationFields,
  isApprovalElicitation,
  useElicitationStore,
} from '@/components/codex/stores';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ElicitationItemProps = {
  currentThreadId: string | null;
};

type FieldOption = { value: string; label: string };

function fieldOptions(field: ElicitationField): FieldOption[] {
  const schema = field.schema as {
    enum?: string[];
    enumNames?: string[];
    oneOf?: McpElicitationConstOption[];
  };
  if (schema.oneOf) {
    return schema.oneOf.map((option) => ({ value: option.const, label: option.title }));
  }
  if (schema.enum) {
    return schema.enum.map((value, index) => ({
      value,
      label: schema.enumNames?.[index] ?? value,
    }));
  }
  return [];
}

export function ElicitationItem({ currentThreadId }: ElicitationItemProps) {
  const { pendingRequests, respond } = useElicitationStore();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  const request = useMemo<ElicitationRequest | null>(
    () => pendingRequests.find((pending) => pending.threadId === currentThreadId) ?? null,
    [pendingRequests, currentThreadId]
  );

  if (!request) {
    return null;
  }

  if (request.mode === 'url') {
    return (
      <div className="rounded-md border bg-background p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{request.serverName}</Badge>
          <span className="font-medium">Authorization required</span>
        </div>
        <div className="text-sm text-muted-foreground">{request.message}</div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => window.open(request.url, '_blank')}>
            Open link
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={submitting}
            onClick={() => {
              setSubmitting(true);
              void respond(request.requestId, 'accept').finally(() => setSubmitting(false));
            }}
          >
            Done
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={submitting}
            onClick={() => {
              setSubmitting(true);
              void respond(request.requestId, 'cancel').finally(() => setSubmitting(false));
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const message = request.message;
  const fields = elicitationFields(request);
  const approval = isApprovalElicitation(request);

  const submitChoice = (action: 'accept' | 'decline' | 'cancel', persist?: string) => {
    setSubmitting(true);
    void respond(request.requestId, action, null, persist ? { persist } : null).finally(() =>
      setSubmitting(false)
    );
  };

  const submitForm = () => {
    setSubmitting(true);
    void respond(request.requestId, 'accept', values).finally(() => {
      setSubmitting(false);
      setValues({});
    });
  };

  const missingRequired = fields.some(
    (field) => field.required && (values[field.id] === undefined || values[field.id] === '')
  );

  return (
    <div className="rounded-md border bg-background p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{request.serverName}</Badge>
        <span className="font-medium">Approval required</span>
        {pendingRequests.length > 1 && (
          <Badge variant="secondary">{pendingRequests.length} pending</Badge>
        )}
      </div>

      <div className="text-sm whitespace-pre-wrap">{message}</div>

      {approval ? (
        <div className="flex flex-wrap gap-2">
          {elicitationChoices(request).map((choice) => (
            <Button
              key={`${choice.action}-${choice.persist ?? 'once'}`}
              size="sm"
              variant={choice.action === 'accept' ? 'default' : 'secondary'}
              disabled={submitting}
              title={choice.description}
              onClick={() => submitChoice(choice.action, choice.persist)}
            >
              {choice.label}
            </Button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field) => {
            const options = fieldOptions(field);
            const value = values[field.id];

            return (
              <div key={field.id} className="space-y-2">
                <Label className="text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-destructive"> *</span>}
                </Label>
                {field.description && (
                  <div className="text-sm text-muted-foreground">{field.description}</div>
                )}

                {options.length > 0 ? (
                  <Select
                    value={typeof value === 'string' ? value : ''}
                    onValueChange={(next) => setValues((prev) => ({ ...prev, [field.id]: next }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.schema.type === 'boolean' ? (
                  <Checkbox
                    checked={value === true}
                    onCheckedChange={(checked) =>
                      setValues((prev) => ({ ...prev, [field.id]: checked === true }))
                    }
                  />
                ) : (
                  <Input
                    type={field.schema.type === 'string' ? 'text' : 'number'}
                    value={value === undefined ? '' : String(value)}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        [field.id]:
                          field.schema.type === 'string'
                            ? event.target.value
                            : Number(event.target.value),
                      }))
                    }
                  />
                )}
              </div>
            );
          })}

          <div className="flex gap-2">
            <Button size="sm" disabled={submitting || missingRequired} onClick={submitForm}>
              Submit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={submitting}
              onClick={() => submitChoice('decline')}
            >
              Decline
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={submitting}
              onClick={() => submitChoice('cancel')}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
