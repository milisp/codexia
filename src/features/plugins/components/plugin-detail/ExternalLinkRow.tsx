import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExternalLinkRowProps {
  label: string;
  url: string;
  onClick: (url: string) => void;
}

export function ExternalLinkRow({ label, url, onClick }: ExternalLinkRowProps) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onClick(url)}>
          <ExternalLink />
        </Button>
      </div>
    </>
  );
}
