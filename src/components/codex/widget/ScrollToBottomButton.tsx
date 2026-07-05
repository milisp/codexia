import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScrollToBottomButtonProps {
  onClick: () => void;
  // Tailwind bottom-offset class, e.g. "bottom-36" to sit above a composer
  bottomClassName?: string;
}

// Floating circular button to jump back to the latest content in a scrollable view.
// Centered horizontally; positioning (bottomClassName) is the only concern this
// component adds on top of the shared shadcn Button.
export function ScrollToBottomButton({
  onClick,
  bottomClassName = 'bottom-4',
}: ScrollToBottomButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      aria-label="Scroll to bottom"
      className={`absolute left-1/2 -translate-x-1/2 z-10 rounded-full shadow-md ${bottomClassName}`}
    >
      <ArrowDown className="size-4" />
    </Button>
  );
}
