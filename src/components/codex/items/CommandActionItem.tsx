import type { CommandAction } from '@/bindings/v2';
import { Badge } from '@/components/ui/badge';
import { getFilename } from '@/utils/getFilename';
import { ShellCommand } from './ShellCommand';

const ACTION_LABEL: Partial<Record<CommandAction['type'], string>> = {
  listFiles: 'Listed files',
  read: 'Read',
  search: 'Search',
};

export const CommandActionItem = ({
  action,
  commandItemId,
  aggregatedOutput,
}: {
  action: CommandAction;
  commandItemId?: string | null;
  aggregatedOutput?: string | null;
}) => {
  if (action.type === 'unknown') {
    return (
      <ShellCommand
        command={action.command}
        commandItemId={commandItemId}
        aggregatedOutput={aggregatedOutput}
      />
    );
  }

  return (
    <div className="flex gap-2 items-center">
      {ACTION_LABEL[action.type]}
      {action.type === 'search' && (
        <>
          <Badge variant="secondary">{action.query}</Badge>
          {action.path && (
            <>
              {' '}
              in <Badge variant="secondary">{getFilename(action.path)}</Badge>
            </>
          )}
        </>
      )}
      {(action.type === 'read' || action.type === 'listFiles') && action.path && (
        <Badge variant="secondary">{getFilename(action.path)}</Badge>
      )}
    </div>
  );
};
