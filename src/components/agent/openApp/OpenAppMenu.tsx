import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type AppStatus, checkAppInstalled, openWorkspaceIn } from '@/services';
import type { OpenAppTarget } from '@/types/openApp';
import { DEFAULT_OPEN_APP_ID, DEFAULT_OPEN_APP_TARGETS, OPEN_APP_STORAGE_KEY } from './constants';
import { GENERIC_APP_ICON, getKnownOpenAppIcon } from './openAppIcons';

type OpenTarget = {
  id: string;
  label: string;
  icon: string;
  target: OpenAppTarget;
  installed: boolean;
};

type Props = {
  path: string;
  openTargets?: OpenAppTarget[];
  selectedOpenAppId?: string;
  onSelectOpenAppId?: (id: string) => void;
};

export function OpenAppMenu({ path, openTargets, selectedOpenAppId, onSelectOpenAppId }: Props) {
  const availableTargets = useMemo(() => {
    return openTargets && openTargets.length > 0 ? openTargets : DEFAULT_OPEN_APP_TARGETS;
  }, [openTargets]);

  const [installStatus, setInstallStatus] = useState<Record<string, AppStatus>>({});
  const [isChecking, setIsChecking] = useState(true);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedOpenAppId) {
      setInternalSelectedId(selectedOpenAppId);
    }
  }, [selectedOpenAppId]);

  useEffect(() => {
    let isMounted = true;
    setIsChecking(true);

    const checkAllTargets = async () => {
      const results = await Promise.all(
        availableTargets.map(async (target) => {
          let status: AppStatus = { installed: true, path: null };

          if (target.kind === 'app' && target.appName) {
            try {
              status = await checkAppInstalled(target.appName);
            } catch {
              status = { installed: false, path: null };
            }
          } else if (target.kind === 'command' && target.command) {
            status = { installed: true, path: target.command };
          }

          return [target.id, status] as const;
        })
      );

      if (isMounted) {
        setInstallStatus(Object.fromEntries(results));
        setIsChecking(false);
      }
    };

    checkAllTargets();

    return () => {
      isMounted = false;
    };
  }, [availableTargets]);

  const resolvedTargets = useMemo<OpenTarget[]>(
    () =>
      availableTargets.map((t) => ({
        id: t.id,
        label: t.label,
        icon: getKnownOpenAppIcon(t.id) ?? GENERIC_APP_ICON,
        target: t,
        installed: installStatus[t.id]?.installed ?? false,
      })),
    [availableTargets, installStatus]
  );

  const availableTargetsForMenu = useMemo(
    () => resolvedTargets.filter((t) => t.target.kind === 'finder' || t.installed),
    [resolvedTargets]
  );

  const storedId =
    typeof window !== 'undefined' ? localStorage.getItem(OPEN_APP_STORAGE_KEY) : null;
  const currentSelectedId =
    internalSelectedId ?? selectedOpenAppId ?? storedId ?? DEFAULT_OPEN_APP_ID;

  const selectedTarget = useMemo(() => {
    return (
      availableTargetsForMenu.find((t) => t.id === currentSelectedId) ??
      availableTargetsForMenu[0] ??
      resolvedTargets[0]
    );
  }, [availableTargetsForMenu, resolvedTargets, currentSelectedId]);

  const openWith = useCallback(
    async (t: OpenTarget) => {
      if (!t) return;
      try {
        if (t.target.kind === 'finder') {
          await revealItemInDir(path);
        } else if (t.target.kind === 'command') {
          await openWorkspaceIn(path, { command: t.target.command, args: t.target.args });
        } else {
          await openWorkspaceIn(path, { appName: t.target.appName, args: t.target.args });
        }
      } catch (err) {
        console.error(`Failed to open path using ${t.label}:`, err);
      }
    },
    [path]
  );

  const handleOpen = () => {
    if (selectedTarget && (selectedTarget.target.kind === 'finder' || selectedTarget.installed)) {
      openWith(selectedTarget);
    }
  };

  const handleSelect = (t: OpenTarget) => {
    setInternalSelectedId(t.id);
    onSelectOpenAppId?.(t.id);
    localStorage.setItem(OPEN_APP_STORAGE_KEY, t.id);
    openWith(t);
  };

  return (
    <div className="flex items-center">
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        disabled={
          isChecking ||
          !selectedTarget ||
          (selectedTarget.target.kind !== 'finder' && !selectedTarget.installed)
        }
        className="flex items-center gap-2"
      >
        {selectedTarget?.icon && (
          <img src={selectedTarget.icon} alt="" className="w-4 h-4 object-contain" />
        )}
        <span>{isChecking ? 'Checking...' : `Open in`}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="px-1" disabled={isChecking}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {availableTargetsForMenu.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No available apps</div>
          ) : (
            availableTargetsForMenu.map((t) => (
              <DropdownMenuItem
                key={t.id}
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => handleSelect(t)}
              >
                {t.icon && <img src={t.icon} alt="" className="w-4 h-4 object-contain" />}
                <span>{t.label}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
