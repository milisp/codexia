import { useEffect, useRef, useState } from 'react';
import { useConfigStore, type Personality } from '@/stores/codex';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import MdEditor from 'react-markdown-editor-lite';
import MarkdownIt from 'markdown-it';
import 'react-markdown-editor-lite/lib/index.css';
import { useThemeContext } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { loadInstructionFile, saveInstructionFile } from '@/utils/instructionFile';

const CUSTOM_INSTRUCTIONS_PATH = '~/.codex/AGENTS.md';

export function PersonalizationSettings() {
  const { personality, setPersonality } = useConfigStore();
  const selectValue = personality ?? 'friendly';
  const { resolvedTheme } = useThemeContext();
  const mdParser = useRef(new MarkdownIt());
  const [instructions, setInstructions] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadInstructions = async () => {
      setLoadError(null);
      try {
        const result = await loadInstructionFile({
          path: CUSTOM_INSTRUCTIONS_PATH,
        });
        if (isActive) {
          setInstructions(result.content);
        }
      } catch (err) {
        if (isActive) {
          setInstructions('');
          const message = err instanceof Error ? err.message : String(err);
          setLoadError(message || 'Failed to load custom instructions.');
        }
      }
    };

    void loadInstructions();

    return () => {
      isActive = false;
    };
  }, []);

  const handleSave = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      await saveInstructionFile({
        path: CUSTOM_INSTRUCTIONS_PATH,
        content: instructions,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveError(message || 'Failed to save custom instructions.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight">Personalization</h3>
        <Card className="p-0">
          <CardContent className="p-0 divide-y divide-border/40">
            <div className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold tracking-tight">Personality</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Choose a default tone for Codex responses
                </p>
              </div>
              <Select
                value={selectValue}
                onValueChange={(value) => setPersonality(value as Personality)}
              >
                <SelectTrigger className="min-w-[160px]">
                  <SelectValue placeholder="Friendly" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="pragmatic">Pragmatic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <h4>Custom instructions</h4>
        <p className="text-xs text-muted-foreground gap-2 flex items-center">
          Edit instructions that tailor Codex to you.{' '}
          <a href="https://developers.openai.com/codex/guides/agents-md/#create-global-guidance">
            Learn more
          </a>
          <ExternalLink className="inline w-4 h-4" />
        </p>
        {loadError ? <p className="text-xs text-muted-foreground">{loadError}</p> : null}
        <div className={resolvedTheme === 'dark' ? 'rc-md-editor-dark' : ''}>
          <MdEditor
            value={instructions}
            view={{ menu: true, md: true, html: false }}
            renderHTML={(text) => mdParser.current.render(text)}
            onChange={({ text }) => setInstructions(text)}
          />
        </div>
        {saveError ? <p className="text-xs text-destructive">{saveError}</p> : null}
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </section>
    </div>
  );
}
