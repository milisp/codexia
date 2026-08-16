import { Check, Monitor, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PairingView } from '@/components/pairing/PairingView';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { type PairedDesktop, usePairingStore } from '@/stores/usePairingStore';

/**
 * Manages paired desktops: switch between them, rename or remove one, or pair
 * another.
 *
 * A drawer rather than a dropdown — a menu row cannot carry a delete
 * affordance, and removing a pairing is the one thing a menu could not do. It
 * slides up from the bottom because on a phone that is where the thumb is, and
 * this is reached from the header of a sidebar that already occupies the left.
 */
export function DesktopDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const desktops = usePairingStore((s) => s.desktops);
  const selectedHost = usePairingStore((s) => s.selectedHost);
  const selectDesktop = usePairingStore((s) => s.selectDesktop);
  const removeDesktop = usePairingStore((s) => s.removeDesktop);
  const renameDesktop = usePairingStore((s) => s.renameDesktop);

  const [pairing, setPairing] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<PairedDesktop | null>(null);
  const [editingHost, setEditingHost] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const startRename = (desktop: PairedDesktop) => {
    setEditingHost(desktop.host);
    setDraftName(desktop.name);
  };

  const commitRename = () => {
    if (!editingHost) return;
    const name = draftName.trim();
    if (name) renameDesktop(editingHost, name);
    setEditingHost(null);
  };

  const select = (desktop: PairedDesktop) => {
    if (desktop.host === selectedHost) {
      onOpenChange(false);
      return;
    }
    selectDesktop(desktop.host);
    // Every store in the app holds threads, sessions and models fetched from
    // the previous machine. Reloading is what keeps one desktop's state from
    // leaking into another's, without each store having to know about pairing.
    window.location.reload();
  };

  const confirmRemoval = () => {
    if (!pendingDeletion) return;
    const wasSelected = pendingDeletion.host === selectedHost;
    removeDesktop(pendingDeletion.host);
    setPendingDeletion(null);
    if (wasSelected) window.location.reload();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[80vh] p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Desktops</SheetTitle>
            <SheetDescription>
              The device token stays valid until you revoke it on that machine.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-1 overflow-y-auto p-2">
            {desktops.map((desktop) => {
              const isSelected = desktop.host === selectedHost;
              if (editingHost === desktop.host) {
                return (
                  <div key={desktop.host} className="flex items-center gap-2 px-2 py-1">
                    <Input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setEditingHost(null);
                      }}
                    />
                    <Button size="sm" onClick={commitRename}>
                      Save
                    </Button>
                  </div>
                );
              }
              return (
                <div
                  key={desktop.host}
                  className="flex items-center gap-2 rounded-md px-2 hover:bg-accent"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
                    onClick={() => select(desktop)}
                  >
                    {isSelected ? (
                      <Check className="size-4 shrink-0 text-primary" />
                    ) : (
                      <Monitor className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{desktop.name}</span>
                      <span className="block truncate text-muted-foreground text-xs">
                        {desktop.host}:{desktop.port}
                      </span>
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground"
                    aria-label={`Rename ${desktop.name}`}
                    onClick={() => startRename(desktop)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${desktop.name}`}
                    onClick={() => setPendingDeletion(desktop)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}

            <Button
              variant="ghost"
              className="justify-start gap-3"
              onClick={() => {
                // Close the drawer first: the pairing form covers the screen,
                // and an open sheet behind it just traps focus.
                onOpenChange(false);
                setPairing(true);
              }}
            >
              <Plus className="size-4" />
              Pair a desktop
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {pairing && (
        <PairingView onPaired={() => setPairing(false)} onCancel={() => setPairing(false)} />
      )}

      <ConfirmDialog
        isOpen={pendingDeletion !== null}
        title={`Remove ${pendingDeletion?.name ?? ''}?`}
        description="You will need the hostname and token again to pair it back."
        onConfirm={confirmRemoval}
        onCancel={() => setPendingDeletion(null)}
      />
    </>
  );
}
