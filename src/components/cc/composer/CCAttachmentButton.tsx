import { open } from '@tauri-apps/plugin-dialog';
import { Image as ImageIcon, Plus } from 'lucide-react';
import { useState } from 'react';
import { SelectFilesMenuItem } from '@/components/codex/composer/AttachmentSelector';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useInputStore } from '@/stores/useInputStore';

interface CCAttachmentButtonProps {
  onImagesSelected?: (paths: string[]) => void;
}

export function CCAttachmentButton({ onImagesSelected }: CCAttachmentButtonProps) {
  const [openState, setOpen] = useState(false);
  const { appendFileLinks } = useInputStore();

  const handleSelectFiles = (paths: string[]) => {
    try {
      appendFileLinks(paths);
      setOpen(false);
    } catch (error) {
      console.error('Failed to select files:', error);
    }
  };

  const handleSelectImages = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Images',
            extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
          },
        ],
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        onImagesSelected?.(paths);
        setOpen(false);
      }
    } catch (error) {
      console.error('Failed to select images:', error);
    }
  };

  return (
    <Popover open={openState} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Add Files"
        >
          <Plus className={`h-4 w-4 ${openState ? 'text-primary' : ''}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-44 p-1">
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            className={cn(
              'justify-start gap-2 px-2 h-8 w-full text-xs hover:bg-blue-500 hover:text-white transition-colors'
            )}
            onClick={handleSelectImages}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Add images</span>
          </Button>
          <SelectFilesMenuItem
            onFilesSelected={handleSelectFiles}
            onAfterSelect={() => setOpen(false)}
            className="h-8 w-full text-xs"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
