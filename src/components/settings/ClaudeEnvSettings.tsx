import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ccGetSettings, ccUpdateSettings } from '@/services/apiAdapt/cc';

type EnvRow = { id: string; key: string; value: string };

const newRow = (key = '', value = ''): EnvRow => ({ id: crypto.randomUUID(), key, value });

const GATEWAY_KEYS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY',
  'ANTHROPIC_DEFAULT_FABLE_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'CLAUDE_CODE_SUBAGENT_MODEL',
];

export function ClaudeEnvSettings() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [rows, setRows] = useState<EnvRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    ccGetSettings<Record<string, unknown>>()
      .then((data) => {
        setSettings(data ?? {});
        const env = (data?.env ?? {}) as Record<string, unknown>;
        setRows(Object.entries(env).map(([key, value]) => newRow(key, String(value ?? ''))));
      })
      .catch((e) => setStatus(String(e)));
  }, []);

  const updateRow = (id: string, patch: Partial<EnvRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addGatewayKeys = () => {
    setRows((prev) => {
      const existing = new Set(prev.map((row) => row.key));
      const missing = GATEWAY_KEYS.filter((key) => !existing.has(key)).map((key) => newRow(key));
      return [...prev, ...missing];
    });
  };

  const save = async () => {
    if (!settings) return;
    const env: Record<string, string> = {};
    for (const row of rows) {
      const key = row.key.trim();
      if (key) env[key] = row.value;
    }
    try {
      await ccUpdateSettings({ ...settings, env });
      setSettings({ ...settings, env });
      setStatus('Saved to ~/.claude/settings.json');
    } catch (e) {
      setStatus(String(e));
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium px-1">Environment Variables</h3>
      <Card>
        <CardContent className="px-4 space-y-3">
          <div className="text-xs text-muted-foreground">
            Written to the <code>env</code> field of <code>~/.claude/settings.json</code>. Empty
            values are kept, so <code>ANTHROPIC_AUTH_TOKEN</code> can be set to an empty string.
          </div>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <Input
                  className="flex-1 font-mono text-xs"
                  placeholder="KEY"
                  value={row.key}
                  onChange={(e) => updateRow(row.id, { key: e.target.value })}
                />
                <Input
                  className="flex-1 font-mono text-xs"
                  placeholder="value"
                  value={row.value}
                  onChange={(e) => updateRow(row.id, { value: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRows((prev) => [...prev, newRow()])}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
            <Button variant="outline" size="sm" onClick={addGatewayKeys}>
              Add gateway keys
            </Button>
            <Button size="sm" onClick={save} disabled={!settings}>
              Save
            </Button>
            {status && <span className="text-xs text-muted-foreground">{status}</span>}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
