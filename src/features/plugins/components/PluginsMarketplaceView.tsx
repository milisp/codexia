import { Search } from 'lucide-react';
import { useState } from 'react';
import type { PluginMarketplaceEntry, PluginSummary } from '@/bindings/v2';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { PluginEntry } from '../hooks/pluginTargets';
import { usePluginsMarketplace } from '../hooks/usePluginsMarketplace';
import { hideBrokenImage } from './imageFallback';
import { MarketplaceErrorCard, PluginCard } from './PluginCard';
import { pluginIconSrc } from './pluginIcon';

/** How many cards a category shows before collapsing the rest behind "See all". */
const CATEGORY_PREVIEW_COUNT = 6;
/** How many plugin icons the "See all" row previews. */
const SEE_ALL_ICON_COUNT = 5;

interface CategorySectionProps {
  category: string;
  items: PluginEntry[];
  /** Force every card visible, e.g. while searching. */
  expanded: boolean;
  installingPluginId: string | null;
  onInstall: (marketplace: PluginMarketplaceEntry, plugin: PluginSummary) => void;
  onUse: (plugin: PluginSummary) => void;
  onDetail: (marketplace: PluginMarketplaceEntry, plugin: PluginSummary) => void;
}

/** One category: a few cards, with the remainder behind a "See all" row of icons. */
function CategorySection({
  category,
  items,
  expanded,
  installingPluginId,
  onInstall,
  onUse,
  onDetail,
}: CategorySectionProps) {
  const [showAll, setShowAll] = useState(false);
  const isExpanded = expanded || showAll;
  const visible = isExpanded ? items : items.slice(0, CATEGORY_PREVIEW_COUNT);
  const hidden = isExpanded ? [] : items.slice(CATEGORY_PREVIEW_COUNT);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">{category}</h2>

      <div className="grid gap-4 md:grid-cols-2">
        {visible.map(({ marketplace, plugin }) => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            isInstalling={installingPluginId === plugin.id}
            canInstall
            onInstall={() => onInstall(marketplace, plugin)}
            onUse={() => onUse(plugin)}
            onDetail={() => onDetail(marketplace, plugin)}
          />
        ))}
      </div>

      {hidden.length > 0 && (
        <Button variant="ghost" className="w-full justify-between" onClick={() => setShowAll(true)}>
          <span className="text-sm">See all {items.length}</span>
          <span className="flex items-center -space-x-2">
            {hidden.slice(0, SEE_ALL_ICON_COUNT).map(({ plugin }) => {
              const iconSrc = pluginIconSrc(plugin);
              return iconSrc ? (
                <img
                  key={plugin.id}
                  src={iconSrc}
                  alt=""
                  className="h-6 w-6 rounded-md object-cover ring-2 ring-background"
                  onError={hideBrokenImage}
                />
              ) : null;
            })}
            {hidden.length > SEE_ALL_ICON_COUNT && (
              <span className="pl-3 text-xs text-muted-foreground">
                +{hidden.length - SEE_ALL_ICON_COUNT}
              </span>
            )}
          </span>
        </Button>
      )}
    </section>
  );
}

interface PluginsMarketplaceViewProps {
  refreshTrigger?: number;
}

export function PluginsMarketplaceView({ refreshTrigger = 0 }: PluginsMarketplaceViewProps) {
  const {
    marketplaces,
    errors,
    isLoading,
    installingPluginId,
    query,
    setQuery,
    handleInstall,
    handleUsePlugin,
    handleShowDetail,
    browseGroups,
  } = usePluginsMarketplace(refreshTrigger);

  if (isLoading && marketplaces.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">Loading plugins...</div>;
  }

  if (marketplaces.length === 0) {
    return (
      <div className="space-y-3 p-4">
        <Card className="py-0">
          <CardHeader className="px-5 py-4">
            <CardTitle>No plugins found</CardTitle>
            <CardDescription>
              No plugin marketplaces were returned by Codex app-server.
            </CardDescription>
          </CardHeader>
        </Card>
        {errors.map((error) => (
          <MarketplaceErrorCard key={`${error.marketplacePath}-${error.message}`} error={error} />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plugins..."
            className="pl-8"
          />
        </div>

        {browseGroups.length === 0 && (
          <p className="text-sm text-muted-foreground">No plugins match "{query}".</p>
        )}

        {browseGroups.map(([category, items]) => (
          <CategorySection
            key={category}
            category={category}
            items={items}
            expanded={!!query.trim()}
            installingPluginId={installingPluginId}
            onInstall={handleInstall}
            onUse={handleUsePlugin}
            onDetail={handleShowDetail}
          />
        ))}

        {errors.map((error) => (
          <MarketplaceErrorCard key={`${error.marketplacePath}-${error.message}`} error={error} />
        ))}
      </div>
    </div>
  );
}
