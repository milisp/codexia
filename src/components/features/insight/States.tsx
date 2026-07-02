import { Button } from '@/components/ui/button';

export function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-violet-500" />
        <p className="text-sm text-slate-400">Scanning agent sessions…</p>
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <p className="mb-3 text-sm text-red-400">{error}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}
