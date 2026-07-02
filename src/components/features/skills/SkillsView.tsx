import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BrowseTab } from '@/components/features/skills/BrowseTab';
import { SkillGroupsBar } from '@/components/features/skills/SkillGroupsBar';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { useTrafficLightConfig } from '@/hooks';
import {
  listCentralSkills,
  readSkillGroups,
  type SkillGroup,
  type SkillGroupsConfig,
  writeSkillGroups,
} from '@/services';
import { useLayoutStore, usePluginStore, useWorkspaceStore } from '@/stores';

export default function SkillsView() {
  const { cwd } = useWorkspaceStore();
  const { isSidebarOpen } = useLayoutStore();
  const { skillScope: scope } = usePluginStore();
  useTrafficLightConfig(isSidebarOpen);
  const [searchQuery, setSearchQuery] = useState('');
  const [installedRefreshKey, setInstalledRefreshKey] = useState(0);
  const [installedNames, setInstalledNames] = useState<Set<string>>(new Set());
  const [groupsConfig, setGroupsConfig] = useState<SkillGroupsConfig>({ groups: [] });
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    listCentralSkills(scope, cwd ?? undefined)
      .then((skills) => setInstalledNames(new Set(skills.map((s) => s.name))))
      .catch(() => {});
  }, [scope, cwd, installedRefreshKey]);

  useEffect(() => {
    readSkillGroups()
      .then((cfg) => {
        setGroupsConfig(cfg);
        setSelectedGroupId((prev) => (prev && cfg.groups.some((g) => g.id === prev) ? prev : null));
      })
      .catch(() => {});
  }, []);

  const saveGroups = useCallback(async (config: SkillGroupsConfig) => {
    setGroupsConfig(config);
    try {
      await writeSkillGroups(config);
    } catch (err) {
      toast.error('Failed to save groups', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const refreshInstalled = useCallback(() => {
    setInstalledRefreshKey((k) => k + 1);
  }, []);

  const handleAddGroup = async (name: string) => {
    const newGroupId = uuidv4();
    const newGroup: SkillGroup = { id: newGroupId, name, skillNames: [] };
    const updated = { groups: [...groupsConfig.groups, newGroup] };
    await saveGroups(updated);
    setSelectedGroupId(newGroupId);
  };

  return (
    <div className="flex flex-col h-full">
      <div>
        <div className="relative mx-20 py-4">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search skills…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 text-xs bg-muted/30 border-none ring-offset-background focus-visible:ring-1"
          />
        </div>

        {/* Groups bar */}
        <SkillGroupsBar
          groupsConfig={groupsConfig}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
          onAddGroup={handleAddGroup}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3">
        <BrowseTab
          searchQuery={searchQuery}
          scope={scope}
          installedIds={installedNames}
          onInstalled={refreshInstalled}
          groupsConfig={groupsConfig}
          onGroupsChange={saveGroups}
          selectedGroupId={selectedGroupId}
        />
      </div>
    </div>
  );
}
