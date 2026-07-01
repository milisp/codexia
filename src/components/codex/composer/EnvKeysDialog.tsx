import { useEffect, useState, useRef } from 'react';
import { ExternalLink, Key, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { setEnv, loadEnvKeys } from '@/services/tauri';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EnvStatusItem } from './ModelList';

type EnvKeysDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EnvKeysDialog({ open, onOpenChange }: EnvKeysDialogProps) {
  const [envKeys, setEnvKeys] = useState<EnvStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [loadTrigger, setLoadTrigger] = useState(0);

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

  const handleInputChange = (provider: string, value: string) => {
    setInputValues((prev) => ({ ...prev, [provider]: value }));
  };

  const handleSave = async (item: EnvStatusItem) => {
    if (!item.env_key) return;
    const valueToSave = inputValues[item.provider] || '';
    if (valueToSave === '••••••••••••') return;

    await setEnv(item.env_key, valueToSave);

    setEnvKeys((prev) =>
      prev.map((k) =>
        k.provider === item.provider ? { ...k, is_env_set: true } : k
      )
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Key className="h-4 w-4" />
            Provider API Keys
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 subtle-scrollbar">
            {envKeys.map((item) => (
              <div
                key={item.provider}
                className="flex flex-col border rounded-md p-2 text-xs gap-2"
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <Label>{item.provider}</Label>

                  <span className="flex">
                    {item.signup_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a href={item.signup_url} target="_blank" rel="noreferrer" title="Sign up">
                          <ExternalLink className="h-3 w-3" /> Sign Up
                        </a>
                      </Button>
                    )}
                    {item.api_key_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a href={item.api_key_url} target="_blank" rel="noreferrer" title="Get API key">
                          <ExternalLink className="h-3 w-3" /> Get API key
                        </a>
                      </Button>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    placeholder={item.is_env_set ? '••••••••••••' : 'API Key'}
                    type="password"
                    className="h-8"
                    value={inputValues[item.provider] || ''}
                    onChange={(e) => handleInputChange(item.provider, e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSave(item)}
                    disabled={!inputValues[item.provider] || inputValues[item.provider] === '••••••••••••'}
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {envKeys.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No providers configured
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}