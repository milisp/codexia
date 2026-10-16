import { describe, expect, it } from 'vitest';
import { formatShortcut, resolveShortcut, SHORTCUTS, type ShortcutDef } from './keymap';

const key = (init: KeyboardEventInit, target?: HTMLElement) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, ...init });
  if (target) Object.defineProperty(event, 'target', { value: target });
  return event;
};

describe('resolveShortcut', () => {
  it('uses Cmd on macOS and Ctrl elsewhere', () => {
    const mac = key({ code: 'KeyU', metaKey: true, shiftKey: true });
    const win = key({ code: 'KeyU', ctrlKey: true, shiftKey: true });

    expect(resolveShortcut(mac, true)).toBe('markUnread');
    expect(resolveShortcut(win, true)).toBeNull();
    expect(resolveShortcut(win, false)).toBe('markUnread');
    expect(resolveShortcut(mac, false)).toBeNull();
  });

  it('requires exact modifiers so Cmd+U and Cmd+Shift+A do not collide', () => {
    expect(resolveShortcut(key({ code: 'KeyU', metaKey: true }), true)).toBeNull();
    expect(resolveShortcut(key({ code: 'KeyA', metaKey: true, shiftKey: true }), true)).toBe(
      'archiveChat'
    );
  });

  it('maps the literal Control key for the terminal toggle on every platform', () => {
    const event = key({ code: 'Backquote', ctrlKey: true });
    expect(resolveShortcut(event, true)).toBe('toggleTerminal');
    expect(resolveShortcut(event, false)).toBe('toggleTerminal');
  });

  it('ignores key repeats and reference-only entries', () => {
    expect(resolveShortcut(key({ code: 'KeyU', metaKey: true, shiftKey: true, repeat: true }), true)).toBeNull();
    expect(resolveShortcut(key({ code: 'KeyN', metaKey: true }), true)).toBeNull();
  });

  describe('input focus guard', () => {
    const defs: ShortcutDef[] = [
      { id: 'markUnread', label: 'Guarded', code: 'KeyU', keyLabel: 'U', mod: true },
      { id: 'settings', label: 'Allowed', code: 'Comma', keyLabel: ',', mod: true, allowInInput: true },
    ];

    it('skips guarded shortcuts while typing in a text field', () => {
      const input = document.createElement('input');
      const event = key({ code: 'KeyU', metaKey: true }, input);
      expect(resolveShortcut(event, true, defs)).toBeNull();
    });

    it('skips guarded shortcuts in a textarea and contenteditable', () => {
      const textarea = document.createElement('textarea');
      const editable = document.createElement('div');
      Object.defineProperty(editable, 'isContentEditable', { value: true });
      expect(resolveShortcut(key({ code: 'KeyU', metaKey: true }, textarea), true, defs)).toBeNull();
      expect(resolveShortcut(key({ code: 'KeyU', metaKey: true }, editable), true, defs)).toBeNull();
    });

    it('still fires allowed shortcuts in a text field', () => {
      const input = document.createElement('input');
      const event = key({ code: 'Comma', metaKey: true }, input);
      expect(resolveShortcut(event, true, defs)).toBe('settings');
    });

    it('fires guarded shortcuts when focus is on a button', () => {
      const button = document.createElement('button');
      const event = key({ code: 'KeyU', metaKey: true }, button);
      expect(resolveShortcut(event, true, defs)).toBe('markUnread');
    });
  });
});

describe('formatShortcut', () => {
  const find = (id: string) => SHORTCUTS.find((s) => s.id === id) as ShortcutDef;

  it('renders platform-specific accelerators', () => {
    expect(formatShortcut(find('markUnread'), true)).toBe('⇧⌘U');
    expect(formatShortcut(find('markUnread'), false)).toBe('Ctrl+Shift+U');
    expect(formatShortcut(find('toggleTerminal'), true)).toBe('⌃`');
  });
});
