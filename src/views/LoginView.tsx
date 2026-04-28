import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import supabase, { isSupabaseConfigured } from '@/lib/supabase';
import { Badge, Github } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';
import { getIsPhone, isTauri } from '@/hooks/runtime';
import { useLayoutStore } from '@/stores';

async function openExternalUrl(url: string) {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else {
    window.location.href = url;
  }
}

export default function AuthPage() {
  const { user } = useAuth();
  const { lastOAuthProvider, setLastOAuthProvider } = useAuthStore();
  const { setView } = useLayoutStore();
  const [email, setEmail] = useState(() => localStorage.getItem('email') || '');
  const [password, setPassword] = useState('');
  const [loadingForm, setLoadingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    getIsPhone().then(setIsMobile);
  }, []);

  // If user is logged in but view is stuck on login, redirect to agent
  useEffect(() => {
    if (user) setView('agent');
  }, [user, setView]);

  if (user) return null;

  const handleOAuthLogin = async (provider: 'github' | 'google' | 'apple') => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      setLastOAuthProvider(provider);
      const client = supabase!;

      const { data } = await client.auth.signInWithOAuth({
        provider,
        options: {
          ...(isTauri() && { skipBrowserRedirect: true }),
          redirectTo: isTauri()
            ? `${import.meta.env.VITE_REDIRECT_URL}?app=tauri`
            : `${window.location.origin}/auth/callback`,
          queryParams:
            provider !== 'apple'
              ? { access_type: 'offline', prompt: 'consent' }
              : undefined,
        },
      });

      if (!isTauri()) return;
      if (!data?.url) throw new Error('No auth URL returned');
      await openExternalUrl(data.url);
    } catch (error: any) {
      console.error(`Error signing in with ${provider}:`, error);
      toast.error(error?.message || `Failed to sign in with ${provider}`);
    }
  };

  // Email + password sign up
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured || !supabase) {
      setFormError('Authentication is not configured');
      return;
    }
    setLoadingForm(true);
    setFormError(null);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      toast.success('Please check your email to confirm');
    } catch (err: any) {
      setFormError(err?.message || 'Sign up failed');
    } finally {
      setLoadingForm(false);
    }
  };

  // Email + password sign in
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured || !supabase) {
      setFormError('Authentication is not configured');
      return;
    }
    setLoadingForm(true);
    setFormError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('Signed in');
      setView('agent');
    } catch (err: any) {
      setFormError(err?.message || 'Sign in failed');
    } finally {
      setLoadingForm(false);
    }
  };

  // Show OAuth on desktop or on iOS (deep-link capable); hide on Android
  const showOAuth = !isMobile || isTauri();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <h1 className="text-3xl font-bold mb-4">Welcome to Codexia</h1>
      <p className="mb-6 text-gray-500 dark:text-gray-400">Sign in to get more</p>

      <div className="w-full max-w-sm text-left">
        <Tabs defaultValue="signin" className="w-full mb-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    localStorage.setItem('email', e.target.value);
                  }}
                  required
                  disabled={!isSupabaseConfigured || loadingForm}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={!isSupabaseConfigured || loadingForm}
                />
              </div>
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <Button
                type="submit"
                className="w-full"
                disabled={!isSupabaseConfigured || loadingForm}
              >
                {loadingForm ? 'Loading...' : 'Sign In'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={!isSupabaseConfigured || loadingForm}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={!isSupabaseConfigured || loadingForm}
                />
              </div>
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <Button
                type="submit"
                className="w-full"
                disabled={!isSupabaseConfigured || loadingForm}
              >
                {loadingForm ? 'Loading...' : 'Sign Up'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {showOAuth && (
          <>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Button
                  onClick={() => handleOAuthLogin('github')}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  Continue with GitHub
                </Button>
                {lastOAuthProvider === 'github' && (
                  <Badge className="absolute -top-2 -right-2 text-xs bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300">
                    Last used
                  </Badge>
                )}
              </div>

              <div className="relative">
                <Button
                  onClick={() => handleOAuthLogin('google')}
                  className="w-full flex items-center justify-center gap-2"
                  variant="outline"
                >
                  <span className="text-sm font-bold">G</span>
                  Continue with Google
                </Button>
                {lastOAuthProvider === 'google' && (
                  <Badge className="absolute -top-2 -right-2 text-xs bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300">
                    Last used
                  </Badge>
                )}
              </div>

              <div className="relative">
                <Button
                  onClick={() => handleOAuthLogin('apple')}
                  className="w-full flex items-center justify-center gap-2"
                  variant="outline"
                >
                  <span className="text-sm"></span>
                  Continue with Apple
                </Button>
                {lastOAuthProvider === 'apple' && (
                  <Badge className="absolute -top-2 -right-2 text-xs bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300">
                    Last used
                  </Badge>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
