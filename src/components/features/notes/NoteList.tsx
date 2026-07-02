import { MessageSquarePlus, Star } from 'lucide-react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { NoteSummary } from '@/hooks/useNotes';

type NoteListItemProps = {
  note: NoteSummary;
  isSelected: boolean;
  onSelect: (noteId: string) => void;
  onAppendToChat: (event: MouseEvent, noteId: string) => void;
  onToggleFavorite: (event: MouseEvent, noteId: string) => void;
};

function NoteListItem({
  note,
  isSelected,
  onSelect,
  onAppendToChat,
  onToggleFavorite,
}: NoteListItemProps) {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(note.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={() => onSelect(note.id)}
      onKeyDown={handleKeyDown}
      className={`group relative flex flex-col items-start gap-1 rounded-lg px-3 py-3 text-left text-sm transition-all hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
        isSelected ? 'bg-accent shadow-sm' : ''
      }`}
    >
      <div className="flex w-full items-center gap-2">
        <div className={`items-center ${isSelected ? 'flex' : 'hidden group-hover:flex'}`}>
          <Button
            onClick={(event) => onAppendToChat(event, note.id)}
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:text-primary"
            title="Add to chat"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button
          onClick={(event) => onToggleFavorite(event, note.id)}
          variant="ghost"
          size="icon"
          className={`h-6 w-6 hover:text-amber-500 ${note.isFavorited ? 'text-amber-500' : 'text-muted-foreground'}`}
          title={note.isFavorited ? 'Unfavorite note' : 'Favorite note'}
        >
          <Star className={`h-3.5 w-3.5 ${note.isFavorited ? 'fill-current' : ''}`} />
        </Button>
        <span
          className={`flex-1 font-semibold truncate ${isSelected ? 'text-accent-foreground' : 'text-foreground'}`}
        >
          {note.title}
        </span>
      </div>
      {note.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] uppercase tracking-wide">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type NoteListProps = {
  notes: NoteSummary[];
  selectedNoteId: string | null;
  loading: boolean;
  error: string | null;
  search: string;
  onSelect: (noteId: string) => void;
  onAppendToChat: (event: MouseEvent, noteId: string) => void;
  onToggleFavorite: (event: MouseEvent, noteId: string) => void;
  onCreate?: () => void;
};

export function NoteList({
  notes,
  selectedNoteId,
  loading,
  error,
  search,
  onSelect,
  onAppendToChat,
  onToggleFavorite,
  onCreate,
}: NoteListProps) {
  return (
    <div className="flex flex-col h-full min-h-0 bg-sidebar/5">
      <ScrollArea className="h-full">
        <div className="px-2 pb-4 space-y-1">
          {loading && (
            <div className="px-4 py-2 text-xs text-muted-foreground animate-pulse">
              Loading notes...
            </div>
          )}
          {error && <div className="px-4 py-2 text-xs text-destructive">{error}</div>}
          {!loading && notes.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              <div className="space-y-2">
                <div>{search ? 'No notes matching search' : 'No notes yet'}</div>
                {!search && onCreate ? (
                  <Button variant="outline" size="sm" className="h-8" onClick={onCreate}>
                    Create note
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          {notes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              isSelected={selectedNoteId === note.id}
              onSelect={onSelect}
              onAppendToChat={onAppendToChat}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
