import { Bot as BotIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Bot } from '@/services/apiAdapt/bots';
import { BotAvatar } from './BotAvatar';

interface BotWelcomeProps {
  bots: Bot[];
  creating: boolean;
  onCreate: () => void;
  onSelect: (bot: Bot) => void;
}

export function BotWelcome({ bots, creating, onCreate, onSelect }: BotWelcomeProps) {
  return (
    <div className="flex flex-1 min-h-0 overflow-y-auto px-6 py-10">
      <div className="m-auto w-full max-w-lg space-y-6">
        <div className="space-y-2 text-center">
          <BotIcon className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">
            {bots.length === 0 ? 'Create your first bot' : 'Who would you like to work with?'}
          </h1>
          {bots.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Give it a role, then start a conversation.
            </p>
          )}
        </div>
        {bots.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {bots.map((item) => (
              <Button
                key={item.id}
                aria-label={`Open ${item.name}`}
                variant="outline"
                className="h-auto justify-start gap-3 px-4 py-3 text-left"
                onClick={() => onSelect(item)}
              >
                <BotAvatar bot={item} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.name}</span>
                  {item.title && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.title}
                    </span>
                  )}
                </span>
              </Button>
            ))}
          </div>
        )}
        <div className="flex justify-center">
          <Button
            variant={bots.length === 0 ? 'default' : 'outline'}
            disabled={creating}
            onClick={onCreate}
          >
            <Plus className="h-4 w-4" />
            {creating ? 'Creating…' : bots.length === 0 ? 'Create bot' : 'New bot'}
          </Button>
        </div>
      </div>
    </div>
  );
}
