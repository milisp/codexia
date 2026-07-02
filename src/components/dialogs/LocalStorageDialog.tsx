import { Copy, Database, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type LocalStorageEntry = {
  key: string;
  value: string;
};

function getLocalStorageEntries(): LocalStorageEntry[] {
  const entries: LocalStorageEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null) {
      entries.push({ key, value: localStorage.getItem(key) ?? '' });
    }
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

function tryPrettyPrint(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function LocalStorageDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [entries, setEntries] = useState<LocalStorageEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const prevIsOpenRef = useRef(isOpen);
  if (isOpen && !prevIsOpenRef.current) {
    prevIsOpenRef.current = isOpen;
    setRefreshTrigger((prev) => prev + 1);
  } else if (!isOpen) {
    prevIsOpenRef.current = isOpen;
  }

  const refresh = () => setEntries(getLocalStorageEntries());

  useEffect(() => {
    if (refreshTrigger === 0) return;
    refresh();
  }, [refreshTrigger]);

  const handleDelete = (key: string) => {
    localStorage.removeItem(key);
    if (selected === key) setSelected(null);
    refresh();
    toast.success(`Deleted "${key}"`);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const selectedEntry = entries.find((e) => e.key === selected);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) setSelected(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="LocalStorage Inspector">
          <Database className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent size="xl" className="p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Database className="size-4" />
            LocalStorage Inspector
            <span className="ml-1 text-muted-foreground text-sm font-normal">
              ({entries.length} keys)
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Fixed height panel — avoids fighting DialogContent's grid layout */}
        <div className="flex h-[60vh]">
          {/* Key list */}
          <div className="w-64 border-r flex flex-col shrink-0 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Keys
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={refresh}
                title="Refresh"
              >
                <RefreshCw className="size-3" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {entries.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">No entries found.</p>
              ) : (
                entries.map((entry) => (
                  <button
                    key={entry.key}
                    onClick={() => setSelected(entry.key)}
                    className={`w-full text-left px-3 py-2 text-sm truncate hover:bg-muted transition-colors flex items-center justify-between group ${
                      selected === entry.key ? 'bg-muted font-medium' : ''
                    }`}
                  >
                    <span className="truncate">{entry.key}</span>
                    <Trash2
                      className="size-3 shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-destructive ml-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(entry.key);
                      }}
                    />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Value panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedEntry ? (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
                  <span className="text-sm font-mono font-medium truncate">
                    {selectedEntry.key}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => handleCopy(selectedEntry.value)}
                      title="Copy raw value"
                    >
                      <Copy className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(selectedEntry.key)}
                      title="Delete entry"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
                    {tryPrettyPrint(selectedEntry.value)}
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Select a key to view its value
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t flex justify-end">
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Close
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
