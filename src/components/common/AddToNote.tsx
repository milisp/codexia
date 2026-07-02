import { NotebookPen } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useNoteStore } from '@/stores/useNoteStore';
import { getErrorMessage } from '@/utils/errorUtils';

type AddToNoteProps = {
  text: string;
  className?: string;
};

export const AddToNote = ({ text, className }: AddToNoteProps) => {
  const [saving, setSaving] = useState(false);
  const { addNote } = useNoteStore();

  const handleClick = async () => {
    if (!text.length || saving) return;
    setSaving(true);
    try {
      await addNote(text);
      toast.success('Saved to notes');
    } catch (err) {
      toast.error('Failed to save note', { description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={!text.length || saving}
      aria-label="Save to note"
      className={className ?? 'h-6 w-6 text-muted-foreground'}
    >
      <NotebookPen className="h-3 w-3" />
    </Button>
  );
};
