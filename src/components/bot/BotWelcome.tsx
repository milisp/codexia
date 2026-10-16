import { Plus } from 'lucide-react';
import kekeStatic from '@/assets/keke/keke.webp';
import kekeWave from '@/assets/keke/keke-wave.webp';
import { Button } from '@/components/ui/button';

interface BotWelcomeProps {
  creating: boolean;
  onCreate: () => void;
}

/** The Bot tab before any bot exists. Once there is one, Today takes over. */
export function BotWelcome({ creating, onCreate }: BotWelcomeProps) {
  return (
    <div className="flex flex-1 min-h-0 overflow-y-auto px-6 py-10">
      <div className="m-auto w-full max-w-lg space-y-6">
        <div className="space-y-2 text-center">
          <picture>
            <source srcSet={kekeStatic} media="(prefers-reduced-motion: reduce)" />
            <img
              src={kekeWave}
              alt=""
              aria-hidden="true"
              className="mx-auto mb-4 h-28 w-28 select-none"
            />
          </picture>
          <h1 className="text-2xl font-semibold tracking-tight">Create your first bot</h1>
          <p className="text-sm text-muted-foreground">
            Give it a role, then start a conversation.
          </p>
        </div>
        <div className="flex justify-center">
          <Button disabled={creating} onClick={onCreate}>
            <Plus className="h-4 w-4" />
            {creating ? 'Creating…' : 'Create bot'}
          </Button>
        </div>
      </div>
    </div>
  );
}
