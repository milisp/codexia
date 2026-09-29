import { ArrowLeft } from 'lucide-react';
import MarkdownIt from 'markdown-it';
import { useEffect, useMemo, useRef, useState } from 'react';
import MdEditor from 'react-markdown-editor-lite';
import 'react-markdown-editor-lite/lib/index.css';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useThemeContext } from '@/contexts/ThemeContext';
import { readTextFile, writeFile } from '@/services';
import { useAgentSettingsStore, useLayoutStore, useWorkspaceStore } from '@/stores';
import { getErrorMessage } from '@/utils/errorUtils';

const CODEX_INSTRUCTIONS_FILE_NAME = 'AGENTS.md';
const CC_INSTRUCTIONS_FILE_NAME = 'CLAUDE.md';

export default function AgentsMdView() {
  const { selectedAgent, setSelectedAgent, instructionType, setInstructionType } =
    useAgentSettingsStore();
  const { cwd } = useWorkspaceStore();
  const { setView } = useLayoutStore();

  const [content, setContent] = useState('');
  const savedContentRef = useRef('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useThemeContext();
  const mdParser = useRef(new MarkdownIt());

  // Ensure we have default values
  const currentAgent = selectedAgent || 'codex';
  const currentInstructionType = instructionType || 'project';

  // Set default values on mount if not set
  useEffect(() => {
    if (!selectedAgent) {
      setSelectedAgent('codex');
    }
    if (!instructionType) {
      setInstructionType('project');
    }
  }, [selectedAgent, instructionType, setSelectedAgent, setInstructionType]);

  const filePath = useMemo(() => {
    const fileName =
      currentAgent === 'cc' ? CC_INSTRUCTIONS_FILE_NAME : CODEX_INSTRUCTIONS_FILE_NAME;

    if (currentInstructionType === 'system') {
      // System instructions: ~/.codex/AGENTS.md or ~/.claude/CLAUDE.md
      const configDir = currentAgent === 'cc' ? '.claude' : '.codex';
      return `~/${configDir}/${fileName}`;
    } else {
      // Project instructions: $cwd/AGENTS.md or $cwd/CLAUDE.md
      if (cwd) {
        const trimmed = cwd.replace(/\/$/, '');
        return `${trimmed}/${fileName}`;
      }
      return fileName;
    }
  }, [cwd, currentAgent, currentInstructionType]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setStatusMessage(null);

    (async () => {
      try {
        const instructions = await readTextFile(filePath);
        if (active) {
          setContent(instructions);
          savedContentRef.current = instructions;
        }
      } catch (err) {
        // If file doesn't exist, start with empty content (for new files)
        const errorMsg = getErrorMessage(err);
        if (errorMsg.includes('does not exist')) {
          if (active) {
            setContent('');
            savedContentRef.current = '';
          }
        } else {
          if (active) {
            setError(errorMsg);
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [filePath]);

  const saveContent = async () => {
    const contentToSave = content;
    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      await writeFile(filePath, contentToSave);
      savedContentRef.current = contentToSave;
      setStatusMessage('Changes saved.');
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndLeave = async () => {
    if (await saveContent()) {
      setView('agent');
    }
  };

  const handleAgentChange = (agent: string) => {
    setSelectedAgent(agent as 'codex' | 'cc');
  };

  const handleInstructionTypeChange = (type: string) => {
    setInstructionType(type as 'system' | 'project');
  };

  const handleBackToChats = () => {
    if (content !== savedContentRef.current) {
      setConfirmLeaveOpen(true);
      return;
    }
    setView('agent');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col border-b">
        {/* Tabs for Agent and Instruction Type */}
        <div className="p-2">
          <div className="flex items-center justify-between gap-2">
            <Button
              onClick={handleBackToChats}
              disabled={loading || saving}
              variant="ghost"
              size="sm"
            >
              <ArrowLeft data-icon="inline-start" />
              Back to chats
            </Button>
            <div className="flex items-center gap-4">
              <Tabs value={currentAgent} onValueChange={handleAgentChange} className="w-auto">
                <TabsList>
                  <TabsTrigger value="codex">Codex</TabsTrigger>
                  <TabsTrigger value="cc">Claude Agent</TabsTrigger>
                </TabsList>
              </Tabs>
              <Tabs
                value={currentInstructionType}
                onValueChange={handleInstructionTypeChange}
                className="w-auto"
              >
                <TabsList>
                  <TabsTrigger value="system">System</TabsTrigger>
                  <TabsTrigger value="project">Project</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        {/* File path and Save button */}
        <div className="flex items-center justify-between px-2">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground">{filePath}</p>
          <Button
            onClick={() => void saveContent()}
            disabled={loading || saving}
            variant="secondary"
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading instructions…</div>
        ) : null}
        {error ? (
          <div className="rounded border border-destructive/70 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {statusMessage ? (
          <div className="rounded border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-900">
            {statusMessage}
          </div>
        ) : null}
        <div className={`min-h-0 ${theme === 'dark' ? 'rc-md-editor-dark' : ''}`}>
          <MdEditor
            value={content}
            style={{ height: 640 }}
            placeholder="Write instructions in markdown…"
            renderHTML={(text) => mdParser.current.render(text)}
            onChange={({ text }) => setContent(text)}
          />
        </div>
      </div>
      <AlertDialog
        open={confirmLeaveOpen}
        onOpenChange={(open) => {
          if (!saving) setConfirmLeaveOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes to {filePath} have not been saved.
            </AlertDialogDescription>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Keep editing</AlertDialogCancel>
            <Button variant="destructive" disabled={saving} onClick={() => setView('agent')}>
              Discard and leave
            </Button>
            <Button disabled={saving} onClick={() => void handleSaveAndLeave()}>
              {saving ? 'Saving…' : 'Save and leave'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
