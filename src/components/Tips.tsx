import { useConfigStore } from '@/components/codex/stores';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';

interface TipsProps {
  onTipClick?: (tip: string) => void;
}

export function Tips({ onTipClick }: TipsProps) {
  const { setWebSearch } = useConfigStore();
  return (
    <div className="flex flex-wrap items-center justify-center text-muted-foreground text-center gap-2">
      {['Create a file', 'Organize files', 'Crunch data'].map((tip) => (
        <Card
          key={tip}
          className="cursor-pointer hover:bg-muted/50 transition-colors p-2"
          onClick={() => onTipClick?.(tip)}
        >
          <CardContent className="p-2">
            <p>{tip}</p>
          </CardContent>
        </Card>
      ))}
      {['https://github.com/anthropics/skills'].map((tip) => (
        <Card
          key={tip}
          className="cursor-pointer hover:bg-muted/50 transition-colors p-2"
          onClick={() => {
            setWebSearch(true);
            toast.success('Web search enabled', {
              description: 'You can install skills from internet by sending message with url.',
            });
            onTipClick?.(`install skills from ${tip}`);
          }}
        >
          <CardContent className="p-2">
            <p>{`Install document skills`}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
