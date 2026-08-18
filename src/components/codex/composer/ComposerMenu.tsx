import { open } from '@tauri-apps/plugin-dialog';
import {
  Check,
  ChevronRight,
  File,
  Globe,
  Image as ImageIcon,
  PlusIcon,
  Target,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScreenshotPopover } from '@/components/codex/composer/ScreenshotPopover';
import { useCodexStore, useConfigStore } from '@/components/codex/stores';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { type MentionItem, mentionsWithIcon, useMentionItems } from './mentions';

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

interface MentionMenuItemProps {
  item: MentionItem;
  onInsert: (text: string) => void;
}

function MentionMenuItem({ item, onInsert }: MentionMenuItemProps) {
  const [promptsOpen, setPromptsOpen] = useState(false);
  const hasPrompts = item.defaultPrompts.length > 0;

  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        className="flex-1 justify-start gap-2 px-2 hover:bg-blue-500 hover:text-white transition-colors"
        onClick={() => onInsert(item.insertText)}
      >
        {item.iconSrc && <img src={item.iconSrc} alt="" className="w-4 h-4" />}
        <span className="flex-1 text-left truncate">{item.displayName}</span>
      </Button>
      {hasPrompts && (
        <Popover open={promptsOpen} onOpenChange={setPromptsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 hover:bg-blue-500 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-64 max-h-[50vh] overflow-y-auto p-1"
            side="right"
            align="start"
          >
            <div className="flex flex-col gap-1">
              {item.defaultPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  variant="ghost"
                  className="justify-start gap-2 px-2 h-auto py-1.5 whitespace-normal text-left hover:bg-blue-500 hover:text-white transition-colors"
                  onClick={() => {
                    setPromptsOpen(false);
                    onInsert(`${item.insertText} ${prompt}`);
                  }}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export interface ComposerMenuProps {
  onImagesSelected?: (paths: string[]) => void;
  onFilesSelected?: (paths: string[]) => void;
  onInsertMention?: (text: string) => void;
}

export function ComposerMenu({
  onImagesSelected,
  onFilesSelected,
  onInsertMention,
}: ComposerMenuProps) {
  const { webSearchRequest, setWebSearch } = useConfigStore();
  const { goalEnabled, setGoalEnabled } = useCodexStore();
  const { t } = useTranslation('composer');
  const [openState, setOpenState] = useState(false);
  const { items } = useMentionItems();
  const mentionItems = mentionsWithIcon(items);

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
      <PopoverContent className="w-48 max-h-[45vh] overflow-y-auto p-1" align="start">
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
          <SelectFilesMenuItem
            onFilesSelected={onFilesSelected}
            onAfterSelect={() => setOpenState(false)}
          />
          {/* Screenshot button */}
          <ScreenshotPopover
            onScreenshotTaken={(path) => {
              if (onImagesSelected) {
                onImagesSelected([path]);
              }
              setOpenState(false);
            }}
          />
          <Button
            variant="ghost"
            className={cn(
              'justify-start gap-2 px-2 hover:bg-blue-500 hover:text-white transition-colors',
              goalEnabled && 'bg-blue-50 text-blue-700'
            )}
            onClick={() => {
              setGoalEnabled(!goalEnabled);
              setOpenState(false);
            }}
          >
            <Target className="w-4 h-4" />
            <span className="flex-1 text-left">{t('goal')}</span>
          </Button>
          {mentionItems.length > 0 && (
            <>
              <Separator className="my-1" />
              {mentionItems.map((item) => (
                <MentionMenuItem
                  key={item.key}
                  item={item}
                  onInsert={(text) => {
                    onInsertMention?.(text);
                    setOpenState(false);
                  }}
                />
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
