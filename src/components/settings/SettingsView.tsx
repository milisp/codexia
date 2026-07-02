import { ChevronDown, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { isTauri } from '@/hooks/runtime';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLayoutStore } from '@/stores';
import { CodexAuth } from '../codex/CodexAuth';
import { ClaudeSettings } from './ClaudeSettings';
import {
  ArchivedThreadSettings,
  ConfigSettings,
  PersonalizationSettings,
  SettingsAgentsSection,
  TaskSettings,
} from './codex';
import { ExplorerSettings } from './ExplorerSettings';
import { GeneralSettings } from './GeneralSettings';
import { PrivacySettings } from './PrivacySettings';
import { ProjectsSettings } from './ProjectsSettings';

type SettingsSection =
  | 'general'
  | 'projects'
  | 'codexauth'
  | 'config'
  | 'personalization'
  | 'privacy'
  | 'archived'
  | 'explorer'
  | 'task'
  | 'agents'
  | 'claude';

const codexSections = [
  'codexauth',
  'task',
  'agents',
  'config',
  'personalization',
  'archived',
] as const;
const topLevelSections = ['general', 'projects', 'privacy', 'claude', 'explorer'] as const;

export default function SettingsView() {
  const { t } = useTranslation('settings');
  const { setView } = useLayoutStore();
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [codexOpen, setCodexOpen] = useState(true);

  const activeSectionContent = (
    <>
      {activeSection === 'general' && <GeneralSettings />}
      {activeSection === 'projects' && <ProjectsSettings />}
      {activeSection === 'privacy' && <PrivacySettings />}
      {activeSection === 'codexauth' && <CodexAuth />}
      {activeSection === 'config' && <ConfigSettings />}
      {activeSection === 'personalization' && <PersonalizationSettings />}
      {activeSection === 'archived' && <ArchivedThreadSettings />}
      {activeSection === 'explorer' && <ExplorerSettings />}
      {activeSection === 'task' && <TaskSettings />}
      {activeSection === 'agents' && <SettingsAgentsSection />}
      {activeSection === 'claude' && <ClaudeSettings />}
    </>
  );

  if (isMobile) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <div className="flex items-center gap-2 border-b px-2 py-2" data-tauri-drag-region>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1 px-2"
            onClick={() => setView('agent')}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-xs">Back</span>
          </Button>
          <Select
            value={activeSection}
            onValueChange={(value) => setActiveSection(value as SettingsSection)}
          >
            <SelectTrigger className="h-9 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {topLevelSections.map((section) => (
                <SelectItem key={section} value={section}>
                  {t(section)}
                </SelectItem>
              ))}
              {codexSections.map((section) => (
                <SelectItem key={section} value={section}>
                  Codex: {t(section)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">{activeSectionContent}</div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      open
      onOpenChange={() => undefined}
      className="h-full w-full"
      style={
        {
          '--sidebar-width': '15rem',
        } as React.CSSProperties
      }
    >
      <Sidebar collapsible="none">
        <SidebarHeader className="gap-2 p-2">
          <div
            className={`flex items-center ${isTauri() && !isMobile ? 'pl-20' : 'pl-2'}`}
            data-tauri-drag-region
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2"
              onClick={() => setView('agent')}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs">{t('backToApp')}</span>
            </Button>
          </div>
        </SidebarHeader>
        <SidebarContent className="min-h-0 min-w-0 max-w-full overflow-x-hidden">
          <ScrollArea className="flex-1 min-h-0 min-w-0 max-w-full overflow-x-hidden">
            <ul className="space-y-1 px-2 text-sm">
              {topLevelSections.map((section) => (
                <li key={section}>
                  <button
                    type="button"
                    onClick={() => setActiveSection(section)}
                    className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                      activeSection === section
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    }`}
                  >
                    {t(section)}
                  </button>
                </li>
              ))}
              <li>
                <Collapsible open={codexOpen} onOpenChange={setCodexOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                    >
                      <span>Codex</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${codexOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 pt-1">
                    {codexSections.map((section) => (
                      <button
                        key={section}
                        type="button"
                        onClick={() => setActiveSection(section)}
                        className={`w-full rounded-lg px-6 py-2 text-left transition-colors ${
                          activeSection === section
                            ? 'bg-accent text-foreground'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                        }`}
                      >
                        {t(section)}
                      </button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </li>
            </ul>
          </ScrollArea>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="h-8" data-tauri-drag-region />
        <div className="h-full min-h-0 w-full bg-background px-3 sm:px-6 py-5 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">{activeSectionContent}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
