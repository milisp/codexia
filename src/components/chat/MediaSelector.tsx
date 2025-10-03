import React from 'react';
import { Button } from '../ui/button';
import { Paperclip, Image, Music } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { useChatInputStore } from '@/stores/chatInputStore';
import { isMediaFile, createMediaAttachment } from '@/utils/mediaUtils';
import { isRemoteRuntime } from "@/lib/tauri-proxy";

export const MediaSelector: React.FC = () => {
  const { addMediaAttachment } = useChatInputStore();

  const handleSelectMedia = async () => {
    try {
      if (isRemoteRuntime()) {
        alert('Adding media is only available from the desktop app for now.');
        return;
      }

      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected: string | string[] | null = await open({
        multiple: true,
        filters: [
          {
            name: 'Media Files',
            extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']
          },
          {
            name: 'Images',
            extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']
          },
          {
            name: 'Audio',
            extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']
          }
        ]
      });

      if (selected) {
        if (Array.isArray(selected)) {
          for (const filePath of selected) {
            const filename = filePath.split(/[\\/]/).pop() || filePath;
            if (isMediaFile(filename)) {
              try {
                const mediaAttachment = await createMediaAttachment(filePath);
                addMediaAttachment(mediaAttachment);
              } catch (error) {
                console.error('Failed to create media attachment:', error);
              }
            }
          }
        } else {
          const filename = (selected as string).split(/[\\/]/).pop() || selected;
          if (isMediaFile(filename)) {
            try {
              const mediaAttachment = await createMediaAttachment(selected as string);
              addMediaAttachment(mediaAttachment);
            } catch (error) {
              console.error('Failed to create media attachment:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectMedia}
              className="h-8 w-8 p-0"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex items-center gap-2 text-xs">
              <Paperclip className="w-3 h-3" />
              Add media files
              <span className="text-gray-400">•</span>
              <Image className="w-3 h-3" />
              <Music className="w-3 h-3" />
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
