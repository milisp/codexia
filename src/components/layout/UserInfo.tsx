import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import supabase, { isSupabaseConfigured } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLayoutStore } from '@/stores/settings';
import { useTranslation } from 'react-i18next';

export function UserInfo() {
  const { user } = useAuth();
  const { clearLastOAuthProvider } = useAuthStore();
  const { setView } = useLayoutStore();
  const { t } = useTranslation();
  const isSignedIn = Boolean(user);
  const avatarUrl = user?.user_metadata?.avatar_url || '';
  const displayName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Guest';

  const handleOpenSettings = () => {
    setView('settings');
  };

  const handleLogout = async () => {
    if (!user) return;
    if (!isSupabaseConfigured || !supabase) {
      toast.error('Authentication is not configured');
      return;
    }
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      clearLastOAuthProvider();
      toast.success('Signed out');
    } catch (error: any) {
      toast.error(error?.message || 'Sign out failed');
    }
  };

  return (
    <div className="w-full border-t px-2 py-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2 px-2 h-8">
            <Avatar className="size-5">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={displayName} />
              ) : (
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              )}
            </Avatar>
            <span className="truncate text-sm">{displayName}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-60 p-1">
          <div className="h-px bg-border my-1" />
          <div className="flex flex-col gap-1">
            <Button variant="ghost" className="w-full justify-start" onClick={handleOpenSettings}>
              {t('sidebar.settings')}
            </Button>
            {isSignedIn ? (
              <>
                <Button variant="ghost" className="w-full justify-start" disabled>
                  {user?.email}
                </Button>
                <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
                  {t('sidebar.signOut')}
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setView('login')}
              >
                {t('sidebar.login')}
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
