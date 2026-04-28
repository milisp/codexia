import { ChevronRight } from 'lucide-react';
import { MCP } from '@/components/icons';
import { Button } from '@/components/ui/button';

// DxtCard component to display manifest info
export function DxtCard({ dxt, onClick }: { dxt: any; onClick?: () => void }) {
  return (
    <div
      className="flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex flex-row items-center gap-3">
        {dxt.icon ? (
          <img src={dxt.icon} alt="icon" className="w-10 h-10 rounded-lg object-cover" />
        ) : (
          <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-lg">
            <MCP size={24} />
          </div>
        )}

        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-bold text-lg truncate">{dxt.display_name}</span>
          <div className="text-sm text-muted-foreground truncate">{dxt.author?.name}</div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
      <div className="mt-3 flex-1">
        <div className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {dxt.description}
        </div>
      </div>
    </div>
  );
}
