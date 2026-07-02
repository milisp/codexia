import { open } from '@tauri-apps/plugin-dialog';
import { Folder } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function FolderSelector({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string | null;
  onChange: (val: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleBrowse = async () => {
    try {
      setIsLoading(true);
      const selectedPath = await open({
        directory: true,
        multiple: false,
      });
      if (selectedPath) {
        onChange(selectedPath as string);
      } else {
        onChange(null);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Outer container takes full width
    <div className="w-full">
      {/* Flex container also takes full width */}
      <div className="flex space-x-2 w-full">
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full flex-1" // Input takes all available space
          placeholder={placeholder}
          readOnly
          disabled={disabled}
        />
        <Button onClick={handleBrowse} disabled={isLoading || disabled}>
          {isLoading ? 'Loading...' : <Folder />}
        </Button>
      </div>
    </div>
  );
}
