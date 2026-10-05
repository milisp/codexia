import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { type UnifiedMcpClientName, unifiedAddMcpServer } from '@/services';
import { addKekeMcpServer } from '@/services/apiAdapt/kekeMcp';
import { appPresets } from './appPresets';
import { ConnectorIcon } from './ConnectorIcon';

interface DefaultMcpServersProps {
  agent: UnifiedMcpClientName | 'keke';
  cwd?: string;
  servers: Record<string, unknown>;
  onServerAdded: () => void;
}

export function DefaultMcpServers({ agent, cwd, servers, onServerAdded }: DefaultMcpServersProps) {
  const [adding, setAdding] = useState<string | null>(null);
  const add = async (preset: (typeof appPresets)[number]) => {
    setAdding(preset.name);
    try {
      if (agent === 'keke') await addKekeMcpServer(preset.name, preset.config);
      else
        await unifiedAddMcpServer({
          clientName: agent,
          path: cwd,
          serverName: preset.name,
          serverConfig: preset.config,
          scope: agent === 'cc' ? 'global' : undefined,
        });
      toast.success(`${preset.label} configured. ${preset.access}.`);
      onServerAdded();
    } catch (error) {
      toast.error(`Could not add ${preset.label}: ${error}`);
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">Featured connectors</h3>
        <p className="text-sm text-muted-foreground">
          Add tools for {agent === 'keke' ? 'your bots' : agent === 'cc' ? 'Claude' : 'Codex'}.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {appPresets.map((preset) => {
          const added = preset.name in servers;
          return (
            <div key={preset.name} className="flex items-start gap-3 rounded-lg border p-4">
              <ConnectorIcon name={preset.name} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm font-medium">{preset.label}</span>
                <p className="text-xs text-muted-foreground">{preset.description}</p>
                <span className="text-xs text-muted-foreground">{preset.access}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                aria-label={`${added ? 'Added' : 'Add'} ${preset.label}`}
                disabled={added || adding !== null}
                onClick={() => void add(preset)}
              >
                {added ? <Check data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
                {added ? 'Added' : adding === preset.name ? 'Adding…' : 'Add'}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
