import { ArrowLeft } from 'lucide-react';
import MarkdownIt from 'markdown-it';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MdEditor from 'react-markdown-editor-lite';
import 'react-markdown-editor-lite/lib/index.css';
import {
  AlertDialog,
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
  const [savedContent, setSavedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
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
          setSavedContent(instructions);
        }
      } catch (err) {
        // If file doesn't exist, start with empty content (for new files)
        const errorMsg = getErrorMessage(err);
        if (errorMsg.includes('does not exist')) {
          if (active) {
            setContent('');
            setSavedContent('');
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

  const handleSave = async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      await writeFile(filePath, content);
      setSavedContent(content);
      setStatusMessage('Changes saved.');
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const leaveEditor = useCallback(() => {
    setView('agent');
  }, [setView]);

  const handleLeaveRequest = () => {
    if (content !== savedContent) {
      setShowLeaveConfirmation(true);
      return;
    }
    leaveEditor();
  };

  const handleSaveAndLeave = async () => {
    if (await handleSave()) {
      setShowLeaveConfirmation(false);
      leaveEditor();
    }
  };

  const handleDiscardAndLeave = () => {
    setShowLeaveConfirmation(false);
    leaveEditor();
  };

  const handleAgentChange = (agent: string) => {
    setSelectedAgent(agent as 'codex' | 'cc');
  };

  const handleInstructionTypeChange = (type: string) => {
    setInstructionType(type as 'system' | 'project');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col border-b">
        {/* Tabs for Agent and Instruction Type */}
        <div className="p-2">
          <div className="flex items-center justify-between gap-2">
            <Button onClick={handleLeaveRequest} variant="ghost" size="sm">
              <ArrowLeft />
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
          <Button onClick={handleSave} disabled={loading || saving} variant="secondary">
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

      <AlertDialog open={showLeaveConfirmation} onOpenChange={setShowLeaveConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes before leaving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to {filePath}. Save them before returning to chats?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLeaveConfirmation(false)}
              disabled={saving}
            >
              Keep editing
            </Button>
            <Button variant="destructive" onClick={handleDiscardAndLeave} disabled={saving}>
              Discard and leave
            </Button>
            <Button onClick={handleSaveAndLeave} disabled={saving}>
              {saving ? 'Saving…' : 'Save and leave'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
