import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

type CopyButtonProps = {
  text: string;
  className?: string;
};

export const CopyButton = ({ text, className }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!text.length) return;
    // Blur immediately so the button doesn't hold focus and keep the parent
    // group in a hover-like visible state after the mouse leaves.
    (e.currentTarget as HTMLButtonElement).blur();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      disabled={!text.length}
      aria-label={copied ? 'Copied' : 'Copy'}
      className={className ?? 'h-6 w-6 text-muted-foreground'}
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
};
