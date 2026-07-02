import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { usePluginStore } from '@/stores';
import { DxtCard } from './DxdCard';
import DxtDetail from './DxtDetail';
import { useDxt } from './useDxt';

export default function DxtView({ refreshTrigger }: { refreshTrigger?: number } = {}) {
  const { dxtList, search, setSearch, loading, handleSearch } = useDxt(refreshTrigger);
  const { selectedDxt, setSelectedDxt } = usePluginStore();

  if (selectedDxt) {
    return <DxtDetail user={selectedDxt.user} repo={selectedDxt.repo} />;
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="max-w-4xl mx-auto w-full flex items-center gap-2 px-3 py-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 pr-10 h-10"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-3">
          {loading && (
            <div className="mb-4 text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dxtList.map((dxt, idx) => {
              const user = dxt.author?.name || 'unknown';
              const repo = dxt.name || 'unknown';
              return <DxtCard key={idx} dxt={dxt} onClick={() => setSelectedDxt({ user, repo })} />;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
