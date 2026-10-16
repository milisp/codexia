import { Card, CardContent } from '@/components/ui/card';
import { formatShortcut, SHORTCUTS } from '@/hooks/keymap';

export function KeyboardShortcuts() {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium px-1">Keyboard shortcuts</h3>
      <Card>
        <CardContent className="px-4">
          <ul className="divide-y">
            {SHORTCUTS.map((def) => (
              <li key={def.id} className="flex items-center justify-between py-2 text-sm">
                <span>{def.label}</span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {formatShortcut(def)}
                </kbd>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
