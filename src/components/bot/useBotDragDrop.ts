import { getCurrentWebview } from '@tauri-apps/api/webview';
import { stat } from '@tauri-apps/plugin-fs';
import { useEffect } from 'react';
import { isDesktopTauri } from '@/hooks/runtime';
import { type Bot, updateBot } from '@/services/apiAdapt/bots';
import { useBotUiStore } from '@/stores/useBotUiStore';

/** Dropping a folder (or a file) onto the bot's chat view sets its workspace. */
export function useBotDragDrop(bot: Bot | undefined) {
  const upsertBot = useBotUiStore((s) => s.upsertBot);
  const botId = bot?.id;
  const botCwd = bot?.cwd;

  useEffect(() => {
    // Only the desktop webview delivers native file drops; elsewhere (web,
    // phone) there is no Tauri window and asking for one throws.
    if (!botId || !isDesktopTauri()) return;
    let cancelled = false;
    const unlisten = getCurrentWebview().onDragDropEvent(async (event) => {
      if (event.payload.type !== 'drop' || cancelled) return;
      const [path] = event.payload.paths;
      if (!path) return;

      const info = await stat(path).catch(() => null);
      const cwd = info?.isDirectory ? path : path.slice(0, path.lastIndexOf('/')) || path;
      if (!cwd || cwd === botCwd) return;

      upsertBot(await updateBot(botId, { cwd }));
    });

    return () => {
      cancelled = true;
      unlisten.then((fn) => fn());
    };
  }, [botId, botCwd, upsertBot]);
}
