import { useEffect, useState } from 'react';
import type { ProviderPreset } from '@/components/codex/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addModelProvider, listProviderPresets } from '@/services/apiAdapt';
import { useModels } from '../hooks/useModels';

type AddProviderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (provider: string) => void;
};

export function AddProviderDialog({ open, onOpenChange, onAdded }: AddProviderDialogProps) {
  const [presets, setPresets] = useState<ProviderPreset[]>([]);
  const [id, setId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [envKey, setEnvKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { configProviders, refreshProviders } = useModels();

  useEffect(() => {
    if (!open) return;
    setError('');
    listProviderPresets()
      .then(setPresets)
      .catch(() => setPresets([]));
  }, [open]);

  const applyPreset = (preset: ProviderPreset) => {
    setId(preset.model_provider);
    setBaseUrl(preset.base_url);
    setEnvKey(preset.env_key);
  };

  const handleSave = async () => {
    const provider = id.trim();
    if (!provider || !baseUrl.trim()) return;
    setSaving(true);
    setError('');
    try {
      // Writes into the user's config.toml — only ever on this explicit action.
      await addModelProvider({ provider, baseUrl: baseUrl.trim(), envKey: envKey.trim() });
      await refreshProviders();
      onAdded?.(provider);
      onOpenChange(false);
      setId('');
      setBaseUrl('');
      setEnvKey('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Add model provider</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          {presets.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Start from a suggestion</Label>
              <div className="flex flex-wrap gap-1">
                {presets.map((preset) => (
                  <Button
                    key={preset.model_provider}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={configProviders.some((p) => p.name === preset.model_provider)}
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.model_provider}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Provider id</Label>
            <Input
              className="h-8"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="openrouter"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Base URL</Label>
            <Input
              className="h-8"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://openrouter.ai/api/v1"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">API key env var</Label>
            <Input
              className="h-8"
              value={envKey}
              onChange={(e) => setEnvKey(e.target.value)}
              placeholder="OPENROUTER_API_KEY"
            />
          </div>

          {error && <div className="text-xs text-destructive">{error}</div>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !id.trim() || !baseUrl.trim()}
            >
              {saving ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
