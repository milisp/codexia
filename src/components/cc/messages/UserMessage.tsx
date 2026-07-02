import { ChevronDown, ChevronUp } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { AddToNote, CopyButton } from '@/components/common';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';

const MAX_COLLAPSED_HEIGHT = 128;

export function UserMessage({ text }: { text: string }) {
  const [collapsed, setCollapsed] = useState(true);
  const [overflows, setOverflows] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (contentRef.current) {
      setOverflows(contentRef.current.scrollHeight > MAX_COLLAPSED_HEIGHT);
    }
  }, [text]);

  return (
    <div className="group flex items-start justify-end gap-1">
      <div className="relative p-2 bg-blue-50 dark:bg-blue-950 max-w-[80%] rounded-md">
        {overflows && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((c) => !c)}
            className="absolute top-1 right-1 z-10 h-5 w-5 text-muted-foreground"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        )}
        <div
          ref={contentRef}
          className={collapsed && overflows ? 'overflow-hidden max-h-32' : undefined}
        >
          <Markdown value={text} />
        </div>
        {overflows && collapsed && (
          <div className="absolute bottom-0 left-0 right-0 h-10 flex items-end justify-center rounded-b-md bg-gradient-to-t from-blue-50 dark:from-blue-950 to-transparent pb-1">
            <Button
              variant="link"
              size="sm"
              onClick={() => setCollapsed(false)}
              className="h-auto p-0 text-xs text-blue-500 dark:text-blue-400 leading-none"
            >
              show more
            </Button>
          </div>
        )}
        {overflows && !collapsed && (
          <div className="flex justify-center mt-1">
            <Button
              variant="link"
              size="sm"
              onClick={() => setCollapsed(true)}
              className="h-auto p-0 text-xs text-blue-500 dark:text-blue-400"
            >
              show less
            </Button>
          </div>
        )}
      </div>
      <div className="invisible group-hover:visible flex flex-col gap-0.5 shrink-0 pt-0.5">
        <AddToNote text={text} className="h-4 w-4 text-muted-foreground" />
        <CopyButton text={text} className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
