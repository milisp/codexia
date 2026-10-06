import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { type UnifiedMcpClientName, unifiedAddMcpServer } from '@/services';
import { addKekeMcpServer, type KekeMcpServer } from '@/services/apiAdapt/kekeMcp';
import { appPresets } from './appPresets';
import { ConnectorIcon } from './ConnectorIcon';
import { KekeGitHubAuthDialog } from './KekeGitHubAuthDialog';
import { KekeMcpAuthControl } from './KekeMcpAuthControl';
import { useKekeMcpAuth } from './useKekeMcpAuth';

interface DefaultMcpServersProps {
  agent: UnifiedMcpClientName | 'keke';
  cwd?: string;
  servers: Record<string, unknown>;
  onServerAdded: () => void;
}

export function DefaultMcpServers({ agent, cwd, servers, onServerAdded }: DefaultMcpServersProps) {
  const auth = useKekeMcpAuth(agent === 'keke');
  const [category, setCategory] = useState('featured');
  const [adding, setAdding] = useState<string | null>(null);
  const catalogKey = `${agent}:${cwd ?? ''}`;
  const [additions, setAdditions] = useState<{
    key: string;
    servers: Record<string, KekeMcpServer>;
  }>({ key: '', servers: {} });
  const justAdded = additions.key === catalogKey ? additions.servers : {};
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
      toast.success(`${preset.label} configured.${preset.access ? ` ${preset.access}.` : ''}`);
      onServerAdded();
      setAdditions((previous) => ({
        key: catalogKey,
        servers: {
          ...(previous.key === catalogKey ? previous.servers : {}),
          [preset.name]: preset.config,
        },
      }));
      if (agent === 'keke') {
        if (preset.authorizationRequired) await auth.authorize(preset.name, preset.config);
        else await auth.refresh();
      }
    } catch (error) {
      toast.error(`Could not add ${preset.label}: ${error}`);
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <KekeGitHubAuthDialog auth={auth} />
      <div>
        <h3 className="text-lg font-semibold">Connectors</h3>
        <p className="text-sm text-muted-foreground">
          Add tools for {agent === 'keke' ? 'your bots' : agent === 'cc' ? 'Claude' : 'Codex'}.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Connector category">
        {[
          { value: 'featured', label: 'Featured' },
          { value: 'all', label: 'All connectors' },
          { value: 'finance', label: 'Finance & economics' },
        ].map((item) => (
          <Button
            key={item.value}
            size="sm"
            variant={category === item.value ? 'secondary' : 'ghost'}
            aria-pressed={category === item.value}
            onClick={() => setCategory(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {appPresets
          .filter(
            (preset) =>
              category === 'all' ||
              (category === 'featured'
                ? preset.category !== 'finance'
                : preset.category === category)
          )
          .map((preset) => {
            const added = preset.name in servers || preset.name in justAdded;
            const config = (servers[preset.name] ?? justAdded[preset.name]) as
              | KekeMcpServer
              | undefined;
            return (
              <div key={preset.name} className="flex items-start gap-3 rounded-lg border p-4">
                <ConnectorIcon name={preset.name} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm font-medium">{preset.label}</span>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                  {preset.access ? (
                    <span className="text-xs text-muted-foreground">{preset.access}</span>
                  ) : null}
                </div>
                {added ? (
                  agent === 'keke' && preset.authorizationRequired ? (
                    <KekeMcpAuthControl name={preset.name} auth={auth} config={config} />
                  ) : (
                    <Check
                      aria-label={`${preset.label} configured`}
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  )
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Add ${preset.label}`}
                    disabled={adding !== null}
                    onClick={() => add(preset)}
                  >
                    <Plus data-icon="inline-start" />
                    {adding === preset.name ? 'Adding…' : 'Add'}
                  </Button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
