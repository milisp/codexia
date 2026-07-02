import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import { I18nextProvider } from 'react-i18next';
import { Toaster as Sonner } from 'sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { i18n } from '@/lib/i18n';

const AboutView = lazy(() => import('@/views/AboutView'));

const isAboutWindow = window.location.pathname === '/about';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nextProvider i18n={i18n}>
        <TooltipProvider>
          {isAboutWindow ? (
            <Suspense>
              <AboutView />
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
