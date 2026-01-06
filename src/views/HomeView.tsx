import { ProjectPanel } from '@/components/panels';
import { Button } from '@/components/ui/button';
import { useNavigationStore } from '@/stores/navigationStore';

export function HomeView() {
  const { setMainView, setSidebarTab, setSelectedAgent, selectedAgent } = useNavigationStore();
  return (
    <div className="m-auto flex flex-col items-center gap-4">
      <div className="flex mt-8 rounded-lg bg-muted p-1 gap-1">
        <button
          className={`px-4 py-2 text-sm rounded-md border-2 transition-all ${selectedAgent === 'codex'
              ? 'border-blue-500 text-blue-600 bg-background shadow-sm'
              : 'border-transparent text-blue-500 hover:border-blue-500/40 hover:bg-blue-500/5'
            }`}
          onClick={() => {
            setSelectedAgent('codex');
          }}
        >
          Codex
        </button>
        <button
          className={`px-4 py-2 text-sm rounded-md border-2 transition-all ${selectedAgent === 'cc'
              ? 'border-orange-500 text-orange-600 bg-background shadow-sm'
              : 'border-transparent text-orange-500 hover:border-orange-500/40 hover:bg-orange-500/5'
            }`}
          onClick={() => {
            setSelectedAgent('cc');
          }}
        >
          Claude Code
        </button>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => {
          setMainView('agents-editor')
          setSidebarTab(null)
        }}>Agent Instructions</Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" onClick={() => setMainView('prompt')}>Prompt</Button>
        <Button variant="secondary" onClick={() => setMainView('skills')}>Skills</Button>
        <Button variant="secondary" onClick={() => setMainView('mcp')}>MCP</Button>
      </div>
      <ProjectPanel />
    </div>
  );
}
