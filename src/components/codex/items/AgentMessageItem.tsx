import { Streamdown } from 'streamdown';
import { CopyButton } from '@/components/common';
import { useWindowFocus } from '@/hooks/useWindowFocus';

type AgentMessageItemProps = {
  text: string;
};

export const AgentMessageItem = ({ text }: AgentMessageItemProps) => {
  const isWindowFocused = useWindowFocus();

  if (!text.trim()) return null;

  return (
    <div className="group flex flex-col items-start gap-1">
      <div className="w-fit min-w-0 max-w-full overflow-x-auto rounded-md border p-2">
        <Streamdown>{text}</Streamdown>
      </div>
      <div
        className={`flex h-7 items-center gap-1 px-1 ${
          isWindowFocused ? 'invisible group-hover:visible group-focus-within:visible' : 'invisible'
        }`}
      >
        <CopyButton text={text} className="h-7 w-7 text-muted-foreground" />
      </div>
    </div>
  );
};
