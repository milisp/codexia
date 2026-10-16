/**
 * Central keymap. Shortcuts follow the Codex desktop app (Cmd on macOS, Ctrl
 * elsewhere). Matching uses `event.code`, so it is layout- and Option-safe.
 */

export type ShortcutId =
  | 'newChat'
  | 'toggleSidebar'
  | 'settings'
  | 'archiveChat'
  | 'markUnread'
  | 'toggleTerminal';

export interface ShortcutDef {
  id: ShortcutId;
  label: string;
  /** `KeyboardEvent.code`, e.g. `KeyU`, `Comma`, `Backquote`. */
  code: string;
  /** Display character for the key. */
  keyLabel: string;
  /** Cmd on macOS, Ctrl elsewhere. */
  mod?: boolean;
  /** The literal Control key on every platform. */
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Fire even while an input, textarea, select or contenteditable has focus. */
  allowInInput?: boolean;
  /** Listed for reference only; another component owns the listener. */
  external?: boolean;
}

export const SHORTCUTS: ShortcutDef[] = [
  { id: 'newChat', label: 'New chat', code: 'KeyN', keyLabel: 'N', mod: true, external: true },
  {
    id: 'toggleSidebar',
    label: 'Toggle sidebar',
    code: 'KeyB',
    keyLabel: 'B',
    mod: true,
    external: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    code: 'Comma',
    keyLabel: ',',
    mod: true,
    allowInInput: true,
  },
  {
    id: 'archiveChat',
    label: 'Archive chat',
    code: 'KeyA',
    keyLabel: 'A',
    mod: true,
    shift: true,
    allowInInput: true,
  },
  {
    id: 'markUnread',
    label: 'Mark chat as unread',
    code: 'KeyU',
    keyLabel: 'U',
    mod: true,
    shift: true,
    allowInInput: true,
  },
  {
    id: 'toggleTerminal',
    label: 'Toggle terminal',
    code: 'Backquote',
    keyLabel: '`',
    ctrl: true,
    allowInInput: true,
  },
];

export const isMacPlatform = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || '');

export function matchesShortcut(event: KeyboardEvent, def: ShortcutDef, isMac: boolean): boolean {
  if (event.code !== def.code) return false;
  const wantMeta = def.mod === true && isMac;
  const wantCtrl = def.ctrl === true || (def.mod === true && !isMac);
  return (
    event.metaKey === wantMeta &&
    event.ctrlKey === wantCtrl &&
    event.shiftKey === (def.shift === true) &&
    event.altKey === (def.alt === true)
  );
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** Human-readable accelerator, e.g. `⌘⇧U` on macOS or `Ctrl+Shift+U` elsewhere. */
export function formatShortcut(def: ShortcutDef, isMac: boolean = isMacPlatform()): string {
  if (isMac) {
    return `${def.ctrl ? '⌃' : ''}${def.alt ? '⌥' : ''}${def.shift ? '⇧' : ''}${def.mod ? '⌘' : ''}${def.keyLabel}`;
  }
  const parts = [
    def.mod || def.ctrl ? 'Ctrl' : null,
    def.alt ? 'Alt' : null,
    def.shift ? 'Shift' : null,
    def.keyLabel,
  ];
  return parts.filter(Boolean).join('+');
}

/**
 * Resolve a key event to a shortcut id, or null. Shortcuts that do not allow
 * typing contexts are skipped while an editable element has focus; held-key
 * repeats never fire.
 */
export function resolveShortcut(
  event: KeyboardEvent,
  isMac: boolean,
  defs: ShortcutDef[] = SHORTCUTS
): ShortcutId | null {
  if (event.repeat) return null;
  for (const def of defs) {
    if (def.external || !matchesShortcut(event, def, isMac)) continue;
    if (!def.allowInInput && isEditableTarget(event.target)) return null;
    return def.id;
  }
  return null;
}
