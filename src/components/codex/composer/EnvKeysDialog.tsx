import { ExternalLink, Key, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EnvStatusItem } from '@/components/codex/types';
import { ProviderIcons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { loadEnvKeys, removeModelProvider, setEnv } from '@/services/apiAdapt';
import type { Provider } from '@/stores/settings';
import { useModels } from '../hooks/useModels';
import { AddProviderDialog } from './AddProviderDialog';

type EnvKeysDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: Provider;
  onProviderChange: (provider: Provider) => void;
};

export function EnvKeysDialog({
  open,
  onOpenChange,
  provider,
  onProviderChange,
}: EnvKeysDialogProps) {
  const [envKeys, setEnvKeys] = useState<EnvStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [loadTrigger, setLoadTrigger] = useState(0);
  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const { configProviders, refreshProviders } = useModels();

  const prevOpenRef = useRef(open);
  if (open && !prevOpenRef.current) {
    prevOpenRef.current = open;
    setLoadTrigger((prev) => prev + 1);
  } else if (!open) {
    prevOpenRef.current = open;
  }

  useEffect(() => {
    if (loadTrigger === 0) return;
    setLoading(true);
    loadEnvKeys()
      .then((keys) => {
        const safeKeys = keys || [];
        setEnvKeys(safeKeys);

        const initialInputs: Record<string, string> = {};
        safeKeys.forEach((item) => {
          initialInputs[item.provider] = item.is_env_set ? '••••••••••••' : '';
        });
        setInputValues(initialInputs);
      })
      .catch(() => setEnvKeys([]))
      .finally(() => setLoading(false));
  }, [loadTrigger]);

  // Whatever config.toml declares; llms.json only supplies the sign-up /
  // API-key links for providers it happens to know.
  const rows = useMemo<EnvStatusItem[]>(() => {
    const known = new Map(envKeys.map((k) => [k.provider, k]));
    return configProviders
      .filter((p) => p.name !== 'openai')
      .map((p) => {
        const item = known.get(p.name);
        return {
          provider: p.name,
          env_key: p.env_key ?? item?.env_key ?? '',
          is_env_set: item?.is_env_set ?? false,
          api_key_url: item?.api_key_url,
          signup_url: item?.signup_url,
        };
      });
  }, [envKeys, configProviders]);

  const handleInputChange = (provider: string, value: string) => {
    setInputValues((prev) => ({ ...prev, [provider]: value }));
  };

  const handleSave = async (item: EnvStatusItem) => {
    if (!item.env_key) return;
    const valueToSave = inputValues[item.provider] || '';
    if (valueToSave === '••••••••••••') return;

    await setEnv(item.env_key, valueToSave);

    setEnvKeys((prev) =>
      prev.map((k) => (k.provider === item.provider ? { ...k, is_env_set: true } : k))
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Key className="h-4 w-4" />
            Providers
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 gap-1 px-2 text-xs"
              onClick={() => setAddProviderOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 subtle-scrollbar">
            {rows.map((item) => (
              <div
                key={item.provider}
                className="flex flex-col border rounded-md p-2 text-xs gap-2"
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="flex min-w-0 items-center gap-1.5 px-1 text-xs">
                    <ProviderIcons providerId={item.provider} size="sm" />
                    <span className="truncate">{item.provider}</span>
                  </span>

                  <span className="flex">
                    {item.signup_url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={item.signup_url} target="_blank" rel="noreferrer" title="Sign up">
                          <ExternalLink className="h-3 w-3" /> Sign Up
                        </a>
                      </Button>
                    )}
                    {item.api_key_url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={item.api_key_url}
                          target="_blank"
                          rel="noreferrer"
                          title="Get API key"
                        >
                          <ExternalLink className="h-3 w-3" /> Get API key
                        </a>
                      </Button>
                    )}
                    {item.provider !== 'ollama' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Remove provider"
                        onClick={async () => {
                          // Deletes the entry from config.toml, not just from the UI.
                          await removeModelProvider(item.provider);
                          await refreshProviders();
                          if (item.provider === provider) onProviderChange('openai');
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </span>
                </div>

                {item.env_key && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      placeholder={item.is_env_set ? '••••••••••••' : item.env_key}
                      type="password"
                      className="h-8"
                      value={inputValues[item.provider] || ''}
                      onChange={(e) => handleInputChange(item.provider, e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSave(item)}
                      disabled={
                        !inputValues[item.provider] || inputValues[item.provider] === '••••••••••••'
                      }
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <AddProviderDialog
          open={addProviderOpen}
          onOpenChange={setAddProviderOpen}
          onAdded={(p) => {
            void refreshProviders();
            onProviderChange(p as Provider);
            setLoadTrigger((prev) => prev + 1);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
