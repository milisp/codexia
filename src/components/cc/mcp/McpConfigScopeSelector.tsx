import { useEffect, useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProjectSelector } from '@/features/ProjectSelector';
import { type McpScope, usePluginStore, useWorkspaceStore } from '@/stores';

interface McpConfigScopeSelectorProps {
  onProjectChange?: () => void;
}

export function McpConfigScopeSelector({ onProjectChange }: McpConfigScopeSelectorProps) {
  const { mcpScope, setMcpScope } = usePluginStore();
  const { cwd } = useWorkspaceStore();
  const mountedRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: cwd is the trigger — this fires on cwd change only, not when the parent re-creates onProjectChange
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    onProjectChange?.();
  }, [cwd]);

  return (
    <div className="flex items-center gap-2">
      Scope:
      <Select value={mcpScope} onValueChange={(s) => setMcpScope(s as McpScope)}>
        <SelectTrigger>
          <SelectValue placeholder="Select Scope">{mcpScope}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="local">Local (This Project Only)</SelectItem>
          <SelectItem value="project">Project (Shared in .mcp.json)</SelectItem>
          <SelectItem value="global">Global (User Level)</SelectItem>
        </SelectContent>
      </Select>
      {mcpScope !== 'global' && <ProjectSelector />}
    </div>
  );
}
