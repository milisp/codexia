import { ArrowDown, ArrowUp } from 'lucide-react';
import type React from 'react';
import { Button } from '@/components/ui/button';

interface CCScrollControlsProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function CCScrollControls({ scrollContainerRef }: CCScrollControlsProps) {
  const handleScrollUp = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  };

  const handleScrollDown = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="absolute bottom-4 right-4 flex shadow-lg z-10">
      <Button
        onClick={handleScrollUp}
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-r-none border-r-0 bg-background/80 backdrop-blur-sm"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        onClick={handleScrollDown}
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-l-none bg-background/80 backdrop-blur-sm"
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
