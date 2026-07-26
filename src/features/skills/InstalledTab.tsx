import { ChevronDown, ChevronRight, Loader2, Package, Pencil, Tag, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  type CentralSkillItem,
  deleteCentralSkill,
  linkSkillToAgent,
  listCentralSkills,
  type SkillGroup,
  type SkillGroupsConfig,
  type SkillScope,
  uninstallInstalledSkill,
} from '@/services';
import { useWorkspaceStore } from '@/stores';
import { AgentBadge } from './AgentBadge';

// ── helpers ──────────────────────────────────────────────────────────────────

function groupsForSkill(groups: SkillGroup[], skillName: string): string[] {
  return groups.filter((g) => g.skillNames.includes(skillName)).map((g) => g.id);
}

// ── sub-components ────────────────────────────────────────────────────────────

function GroupAssignPopover({
  skillName,
  groups,
  onToggle,
}: {
  skillName: string;
  groups: SkillGroup[];
  onToggle: (groupId: string, add: boolean) => void;
}) {
  const assigned = useMemo(() => groupsForSkill(groups, skillName), [groups, skillName]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
          title="Assign to group"
        >
          <Tag className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end">
        {groups.length === 0 ? (
          <p className="px-1 py-1.5 text-xs text-muted-foreground">No groups yet</p>
        ) : (
          <div className="space-y-0.5">
            {groups.map((g) => {
              const active = assigned.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onToggle(g.id, !active)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors',
                    active ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full shrink-0',
                      active ? 'bg-primary' : 'bg-muted-foreground/40'
                    )}
                  />
                  <span className="truncate">{g.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SkillCard({
  skill,
  groups,
  togglingKey,
  deleting,
  onToggleAgent,
  onDelete,
  onGroupToggle,
}: {
  skill: CentralSkillItem;
  groups: SkillGroup[];
  togglingKey: string | null;
  deleting: boolean;
  onToggleAgent: (skill: CentralSkillItem, agent: 'codex' | 'cc') => void;
  onDelete: (skill: CentralSkillItem) => void;
  onGroupToggle: (groupId: string, skillName: string, add: boolean) => void;
}) {
  return (
    <div className="group flex flex-col justify-between gap-3 rounded-lg border border-muted/60 bg-card/50 p-4 transition-all hover:border-primary/30 hover:bg-card hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-muted/50 p-2 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          <Package className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-sm font-bold tracking-tight">{skill.name}</span>
            <span className="flex items-center gap-0.5 shrink-0">
              <GroupAssignPopover
                skillName={skill.name}
                groups={groups}
                onToggle={(groupId, add) => onGroupToggle(groupId, skill.name, add)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(skill)}
                disabled={Boolean(togglingKey) || deleting}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </span>
          </div>
          {skill.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{skill.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 pt-1">
        <AgentBadge
          label="Codex"
          active={skill.linkedCodex}
          loading={togglingKey === `${skill.name}:codex`}
          onClick={() => onToggleAgent(skill, 'codex')}
        />
        <AgentBadge
          label="CC"
          active={skill.linkedCc}
          loading={togglingKey === `${skill.name}:cc`}
          onClick={() => onToggleAgent(skill, 'cc')}
        />
      </div>
    </div>
  );
}

function GroupSection({
  title,
  count,
  defaultOpen = true,
  children,
  onRename,
  onDelete,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  onRename?: (name: string) => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) onRename?.(trimmed);
    setEditing(false);
  };

  return (
    <div>
      <div className="flex items-center gap-1 py-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        {editing ? (
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="h-5 px-1 text-xs font-semibold w-32 border-primary/40"
          />
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            {title}
          </button>
        )}
        <span className="text-[10px] text-muted-foreground/60 ml-0.5">{count}</span>
        <div className="flex-1 border-t border-muted/40 mx-2" />
        {onRename && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(title);
              setEditing(true);
            }}
            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-muted-foreground/50 hover:text-destructive transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {open && (
        <div className="grid grid-cols-1 gap-3 pb-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function InstalledTab({
  searchQuery,
  scope,
  refreshKey,
  groupsConfig,
  onGroupsChange,
  selectedGroupId = null,
}: {
  searchQuery: string;
  scope: SkillScope;
  refreshKey: number;
  groupsConfig: SkillGroupsConfig;
  onGroupsChange: (config: SkillGroupsConfig) => Promise<void>;
  selectedGroupId?: string | null;
}) {
  const { cwd } = useWorkspaceStore();
  const [skills, setSkills] = useState<CentralSkillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CentralSkillItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const groups = groupsConfig.groups;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSkills(await listCentralSkills(scope, cwd ?? undefined));
    } catch (err) {
      toast.error('Failed to load skills', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [scope, cwd]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const handleRenameGroup = async (groupId: string, name: string) => {
    await onGroupsChange({ groups: groups.map((g) => (g.id === groupId ? { ...g, name } : g)) });
  };

  const handleDeleteGroup = async (groupId: string) => {
    await onGroupsChange({ groups: groups.filter((g) => g.id !== groupId) });
  };

  const handleGroupToggle = async (groupId: string, skillName: string, add: boolean) => {
    await onGroupsChange({
      groups: groups.map((g) => {
        if (g.id !== groupId) return g;
        const skillNames = add
          ? [...g.skillNames.filter((n) => n !== skillName), skillName]
          : g.skillNames.filter((n) => n !== skillName);
        return { ...g, skillNames };
      }),
    });
  };

  const handleToggleAgent = async (skill: CentralSkillItem, agent: 'codex' | 'cc') => {
    const key = `${skill.name}:${agent}`;
    if (togglingKey) return;
    setTogglingKey(key);
    const linked = agent === 'codex' ? skill.linkedCodex : skill.linkedCc;
    try {
      if (linked) {
        await uninstallInstalledSkill(skill.name, agent, scope, cwd ?? undefined);
      } else {
        await linkSkillToAgent(skill.name, agent, scope, cwd ?? undefined);
      }
      await load();
    } catch (err) {
      toast.error(`Failed to ${linked ? 'unlink' : 'link'} ${skill.name}`, {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTogglingKey(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteCentralSkill(deleteTarget.name, scope, cwd ?? undefined);
      // Remove from groups
      await onGroupsChange({
        groups: groups.map((g) => ({
          ...g,
          skillNames: g.skillNames.filter((n) => n !== deleteTarget.name),
        })),
      });
      setSkills((prev) => prev.filter((s) => s.name !== deleteTarget.name));
      toast.success(`Deleted ${deleteTarget.name}`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(`Failed to delete ${deleteTarget.name}`, {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(
    () =>
      skills.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.description?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [skills, searchQuery]
  );

  // When a group is selected from the top bar, only show that group
  const visibleGroups = useMemo(
    () => (selectedGroupId ? groups.filter((g) => g.id === selectedGroupId) : groups),
    [groups, selectedGroupId]
  );

  const ungrouped = useMemo(
    () =>
      selectedGroupId
        ? []
        : filtered.filter((s) => !new Set(groups.flatMap((g) => g.skillNames)).has(s.name)),
    [selectedGroupId, filtered, groups]
  );

  const skillsByGroup = useMemo(
    () =>
      visibleGroups.map((g) => ({
        group: g,
        skills: g.skillNames
          .map((name) => filtered.find((s) => s.name === name))
          .filter((s): s is CentralSkillItem => Boolean(s)),
      })),
    [visibleGroups, filtered]
  );

  const cardProps = {
    groups,
    togglingKey,
    deleting,
    onToggleAgent: handleToggleAgent,
    onDelete: setDeleteTarget,
    onGroupToggle: handleGroupToggle,
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin" />
        <p className="mt-3 text-sm">Loading…</p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4">
          <Package className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-semibold">
          {searchQuery ? `No results for "${searchQuery}"` : 'No skills installed'}
        </h3>
        {!searchQuery && (
          <p className="mt-1 text-sm text-muted-foreground">
            Browse the marketplace to install skills.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 pb-4">
        {/* User-defined groups */}
        {skillsByGroup.map(({ group, skills: groupSkills }) => (
          <GroupSection
            key={group.id}
            title={group.name}
            count={groupSkills.length}
            onRename={(name) => void handleRenameGroup(group.id, name)}
            onDelete={() => void handleDeleteGroup(group.id)}
          >
            {groupSkills.length === 0 ? (
              <p className="col-span-full py-4 text-center text-xs text-muted-foreground">
                No skills in this group — use the <Tag className="inline h-3 w-3" /> button on a
                skill to add it here.
              </p>
            ) : (
              groupSkills.map((s) => <SkillCard {...cardProps} key={s.name} skill={s} />)
            )}
          </GroupSection>
        ))}

        {/* Ungrouped */}
        {ungrouped.length > 0 && (
          <GroupSection
            title={groups.length > 0 ? 'Ungrouped' : 'All Skills'}
            count={ungrouped.length}
            defaultOpen
          >
            {ungrouped.map((s) => (
              <SkillCard {...cardProps} key={s.name} skill={s} />
            ))}
          </GroupSection>
        )}
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Delete skill
            </AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong className="text-foreground">{deleteTarget?.name}</strong> from the
              central store and all agent links?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Deleting
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
