import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';
import { useLayoutStore } from '@/stores';
import { useTranslation } from 'react-i18next';

export function UserInfo() {
  const { setView } = useLayoutStore();
  const { t } = useTranslation("sidebar");

  const handleOpenSettings = () => {
    setView('settings');
  };

  return (
    <div className="w-full border-t px-2 py-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2 px-2 h-8">
            <User className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-60 p-1">
          <div className="flex flex-col gap-1">
            <Button variant="ghost" className="w-full justify-start" onClick={handleOpenSettings}>
              {t('settings')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
