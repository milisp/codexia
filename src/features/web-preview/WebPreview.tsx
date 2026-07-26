import { openUrl } from '@tauri-apps/plugin-opener';
import { ArrowLeft, ArrowRight, ExternalLink, Globe, RefreshCw } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isTauri } from '@/hooks/runtime';
import { useWebviewStore } from '@/stores/useWebViewStore';

interface WebPreviewProps {
  url?: string;
  onUrlChange?: (url: string) => void;
}

export const WebPreview: React.FC<WebPreviewProps> = ({ url = '', onUrlChange }) => {
  const { history, index, addUrl, goBack, goForward } = useWebviewStore();
  const currentUrl = history[index] ?? '';
  const [inputUrl, setInputUrl] = useState(currentUrl);
  const [isLoading, setIsLoading] = useState(false);

  // Sync inputUrl with store's currentUrl when it changes
  useEffect(() => {
    setInputUrl(currentUrl);
  }, [currentUrl]);

  // Add prop url to store when it changes
  useEffect(() => {
    if (url) {
      addUrl(url);
    }
  }, [url, addUrl]);

  // Notify parent of URL changes via onUrlChange
  useEffect(() => {
    if (currentUrl) {
      onUrlChange?.(currentUrl);
    }
  }, [currentUrl, onUrlChange]);

  const handleRefresh = () => {
    setIsLoading(true);
    // Force iframe reload by changing key
    const iframe = document.querySelector('#web-preview-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
    setTimeout(() => setIsLoading(false), 1000);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Add the input URL to history (store will handle duplicates and history management)
    url && addUrl(inputUrl);
    // Clear the input after submitting? Or keep it? We'll keep it as the current URL.
    // The effect above will sync the input with the store's currentUrl after addUrl.
  };

  const handleOpenExternal = async () => {
    if (isTauri()) {
      await openUrl(currentUrl);
    } else {
      window.open(currentUrl, '_blank');
    }
  };

  return (
    <div className="h-full flex flex-col bg-background border-l">
      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
        <Button
          onClick={goBack}
          disabled={index <= 0}
          size="icon"
          variant="ghost"
          className="h-7 w-7 p-0"
        >
          <ArrowLeft className="w-3 h-3" />
        </Button>
        <Button
          onClick={goForward}
          disabled={index >= history.length - 1}
          size="icon"
          variant="ghost"
          className="h-7 w-7 p-0"
        >
          <ArrowRight className="w-3 h-3" />
        </Button>
        <Button
          onClick={handleRefresh}
          size="icon"
          variant="ghost"
          disabled={isLoading}
          className="h-7 w-7 p-0"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>

        <form onSubmit={handleUrlSubmit} className="flex-1 flex gap-1">
          <Input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Enter URL..."
            className="text-xs h-7"
          />
        </form>
        <Button onClick={handleOpenExternal} size="sm" variant="ghost" className="h-7 w-7 p-0">
          <ExternalLink className="w-3 h-3" />
        </Button>
      </div>

      {/* Preview Content */}
      <div className="flex-1 relative overflow-hidden">
        {currentUrl ? (
          <iframe
            id="web-preview-iframe"
            src={currentUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="Web Preview"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {history.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {history.map((historyUrl: string, idx: number) => (
                  <li key={idx}>
                    <Button
                      onClick={() => addUrl(historyUrl)}
                      variant="outline"
                      className="text-xs truncate max-w-md"
                    >
                      {historyUrl}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center">
                <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Enter a URL to preview</p>
                <p className="text-xs mt-1">Perfect for Next.js, React apps, and more</p>
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
};
