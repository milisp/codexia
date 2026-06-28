import { useState } from 'react';
import { PlusIcon, Globe, Image as ImageIcon, Check, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScreenshotPopover } from '@/components/codex/composer/ScreenshotPopover';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useConfigStore } from '@/components/codex/stores';
import { cn } from '@/lib/utils';
import { open } from '@tauri-apps/plugin-dialog';

interface SelectFilesMenuItemProps {
  onFilesSelected?: (paths: string[]) => void;
  onAfterSelect?: () => void;
  className?: string;
}

export function SelectFilesMenuItem({
  onFilesSelected,
  onAfterSelect,
  className,
}: SelectFilesMenuItemProps) {
  const handleSelectFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        directory: false,
      });

      if (!selected) {
        return;
      }

      const paths = Array.isArray(selected) ? selected : [selected];
      onFilesSelected?.(paths);
      onAfterSelect?.();
    } catch (error) {
      console.error('Failed to select files:', error);
    }
  };

  return (
    <Button
      variant="ghost"
      className={cn(
        'justify-start gap-2 px-2 hover:bg-blue-500 hover:text-white transition-colors',
        className
      )}
      onClick={handleSelectFiles}
    >
      <File className="w-4 h-4" />
      <span>Select files</span>
    </Button>
  );
}

export interface AttachmentSelectorProps {
  onImagesSelected?: (paths: string[]) => void;
  onFilesSelected?: (paths: string[]) => void;
}

export function AttachmentSelector({ onImagesSelected, onFilesSelected }: AttachmentSelectorProps) {
  const { webSearchRequest, setWebSearch } = useConfigStore();
  const [openState, setOpenState] = useState(false);

  const handleSelectImage = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Images',
            extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'],
          },
        ],
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        if (onImagesSelected) {
          onImagesSelected(paths);
        }
        setOpenState(false);
      }
    } catch (error) {
      console.error('Failed to select image:', error);
    }
  };

  return (
    <Popover open={openState} onOpenChange={setOpenState}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <PlusIcon className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            className={cn(
              'justify-start gap-2 px-2 hover:bg-blue-500 hover:text-white transition-colors',
              webSearchRequest && 'bg-blue-100 text-blue-900'
            )}
            onClick={() => {
              setWebSearch(!webSearchRequest);
              setOpenState(false);
            }}
          >
            <Globe className="w-4 h-4" />
            <span className="flex-1 text-left">Web search</span>
            {webSearchRequest && <Check className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            className="justify-start gap-2 px-2 hover:bg-blue-500 hover:text-white transition-colors"
            onClick={handleSelectImage}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Add images</span>
          </Button>
          <SelectFilesMenuItem onFilesSelected={onFilesSelected} onAfterSelect={() => setOpenState(false)} />
          {/* Screenshot button */}
          <ScreenshotPopover
            onScreenshotTaken={(path) => {
              if (onImagesSelected) {
                onImagesSelected([path]);
              }
              setOpenState(false);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
