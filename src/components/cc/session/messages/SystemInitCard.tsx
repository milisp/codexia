import { useState } from 'react';
import { Card } from '@/components/ui/card';
import type { SystemMessage } from '../../types/messages';

interface Props {
  msg: SystemMessage;
}

export function SystemInitCard({ msg }: Props) {
  const [showTools, setShowTools] = useState(false);
  return (
    <Card className="p-2 bg-muted/30 border-border">
      <div className="text-xs text-muted-foreground">
        Session: {msg.session_id}
        {msg.tools && (
          <>
            {' | '}
            <button
              onClick={() => setShowTools((p) => !p)}
              className="underline hover:text-foreground cursor-pointer"
            >
              {msg.tools.length} tools
            </button>
          </>
        )}
        {msg.model && ` | ${msg.model}`}
      </div>
      {showTools && msg.tools && (
        <div className="mt-2 pt-2 border-t border-border flex flex-wrap gap-1">
          {msg.tools.map((tool: string, i: number) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground border border-border/50"
            >
              {tool}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
