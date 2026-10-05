import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { type Bot, deleteBot } from '@/services/apiAdapt/bots';
import { useBotUiStore } from '@/stores/useBotUiStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { usePluginsNavigationStore } from '@/stores/usePluginsNavigationStore';
import { BotCollaborationFields } from './BotCollaborationFields';
import { BotIdentityFields } from './BotIdentityFields';
import { BotMcpFields } from './BotMcpFields';
import { BotModelFields } from './BotModelFields';
import { BotTrustFields } from './BotTrustFields';
import { saveBotSettings } from './saveBotSettings';
import { useBotSettingsForm } from './useBotSettingsForm';

interface BotSettingsDialogProps {
  bot: Bot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BotSettingsDialog({ bot, open, onOpenChange }: BotSettingsDialogProps) {
  const { removeBot } = useBotUiStore();
  const form = useBotSettingsForm(bot, open);
  const [saving, setSaving] = useState(false);
  const running = useBotUiStore((state) => Boolean(state.runningByBot[bot.id]));

  const save = async () => {
    if (saving || useBotUiStore.getState().runningByBot[bot.id]) return false;
    setSaving(true);
    try {
      await saveBotSettings(bot, form.patch);
      onOpenChange(false);
      return true;
    } catch (e) {
      toast({ title: 'Could not save', description: String(e), variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await deleteBot(bot.id);
      removeBot(bot.id);
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Could not delete', description: String(e), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{bot.name}</DialogTitle>
          <DialogDescription>Changes apply to the bot’s next task.</DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <div className="space-y-4">
            <BotIdentityFields
              name={form.name}
              onNameChange={form.setName}
              title={form.title}
              onTitleChange={form.setTitle}
              avatar={form.avatar}
              onAvatarChange={form.setAvatar}
              color={form.color}
              onColorChange={form.setColor}
              cwd={form.cwd}
              onCwdChange={form.setCwd}
            />

            <BotModelFields
              cwd={form.cwd}
              provider={form.provider}
              onProviderChange={form.setProvider}
              model={form.model}
              onModelChange={form.setModel}
              reasoningEffort={form.reasoningEffort}
              onReasoningEffortChange={form.setReasoningEffort}
            />

            <div className="space-y-1">
              <Label htmlFor="bot-prompt">Persona</Label>
              <Textarea
                id="bot-prompt"
                rows={4}
                value={form.systemPrompt}
                placeholder="Who this bot is, and how it should work."
                onChange={(e) => form.setSystemPrompt(e.target.value)}
              />
            </div>

            <BotTrustFields
              trustLevel={form.trustLevel}
              onTrustLevelChange={form.setTrustLevel}
              approvedTools={form.approvedTools}
              onApprovedToolsChange={form.setApprovedTools}
            />

            <BotMcpFields
              mcpServers={form.mcpServers}
              onMcpServersChange={form.setMcpServers}
              disabled={saving || running}
              onManageTools={async () => {
                if (await save()) {
                  usePluginsNavigationStore.getState().openBotConnectors();
                  useLayoutStore.getState().setView('plugins');
                }
              }}
            />
            <BotCollaborationFields
              botId={bot.id}
              allowedBotIds={form.allowedBotIds}
              onAllowedBotIdsChange={form.setAllowedBotIds}
            />
          </div>
        </div>

        {running && (
          <p className="text-xs text-muted-foreground">Stop the current task to save settings.</p>
        )}
        <DialogFooter className="justify-between sm:justify-between">
          <Button variant="ghost" className="text-destructive" onClick={remove}>
            Delete bot
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={saving || running} onClick={save}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
