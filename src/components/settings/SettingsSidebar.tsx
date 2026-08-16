import { Button } from '@/components/ui/button';

interface SettingsSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const SECTIONS = [
  { id: 'login', label: 'Codex login' },
  { id: 'rateLimit', label: 'Codex rate limit' },
  { id: 'promptOptimizer', label: 'Prompt Optimizer' },
  { id: 'exclude', label: 'Exclude Folders' },
  { id: 'gitWorktree', label: 'Git Worktree' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'quote', label: 'Quote Filters' },
];

export default function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  return (
    <div className="w-64 border-r bg-muted/30 px-4 space-y-2">
      {SECTIONS.map((section) => (
        <Button
          key={section.id}
          variant={activeSection === section.id ? 'default' : 'ghost'}
          className="w-full justify-start"
          onClick={() => onSectionChange(section.id)}
        >
          {section.label}
        </Button>
      ))}
    </div>
  );
}
