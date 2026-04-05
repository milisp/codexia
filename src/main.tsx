import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/lib/i18n';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

const AboutView = lazy(() => import('@/views/AboutView'));
const AuthCallbackView = lazy(() => import('@/views/AuthCallbackView'));

const isAboutWindow = window.location.pathname === '/about';
const isAuthCallback = window.location.pathname === '/auth/callback';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nextProvider i18n={i18n}>
        <TooltipProvider>
          {isAboutWindow ? (
            <Suspense>
              <AboutView />
            </Suspense>
          ) : isAuthCallback ? (
            <Suspense>
              <AuthCallbackView />
            </Suspense>
          ) : (
            <>
              <App />
              <Toaster />
              <Sonner position="top-center" richColors />
            </>
          )}
        </TooltipProvider>
      </I18nextProvider>
    </ThemeProvider>
  </React.StrictMode>
);
