import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ccSetPermissionMode } from '@/services';
import { useCCStore } from '@/stores';
import type { PermissionMode } from '@/stores/cc';

export function CCPermissionModeSelect() {
  const { options, updateOptions, activeSessionId } = useCCStore();
  const { permissionMode } = options;

  const handlePermissionChange = async (value: string) => {
    const permissionValue = value as PermissionMode;
    updateOptions({ permissionMode: permissionValue });
    if (!activeSessionId) return;
    try {
      await ccSetPermissionMode(activeSessionId, permissionValue);
    } catch (error) {
      console.error('Failed to set permission mode:', error);
    }
  };

  return (
    <Select value={permissionMode} onValueChange={handlePermissionChange}>
      <SelectTrigger className="h-7 w-[108px] text-[10px] bg-transparent border-none focus:ring-0 focus:ring-offset-0 pr-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent side="top">
        <SelectItem value="default" className="text-xs">
          Ask Permission
        </SelectItem>
        <SelectItem value="acceptEdits" className="text-xs">
          Accept Edits
        </SelectItem>
        <SelectItem value="plan" className="text-xs">
          Plan Mode
        </SelectItem>
        <SelectItem value="bypassPermissions" className="text-xs">
          Bypass All
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
