import { Component, type ReactNode } from 'react';
import { LocalStorageDialog } from '@/components/dialogs/LocalStorageDialog';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class StoreErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-8 text-center">
        <p className="text-destructive font-semibold text-lg">App failed to render</p>
        <p className="text-muted-foreground text-sm max-w-md">
          A store may have corrupted or incompatible data in localStorage. Use the inspector below
          to delete the offending key, then reload.
        </p>
        <p className="font-mono text-xs text-muted-foreground bg-muted px-3 py-1 rounded">
          {error.message}
        </p>
        <LocalStorageDialog defaultOpen />
        <button
          type="button"
          className="text-sm underline text-muted-foreground mt-2"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}
