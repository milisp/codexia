import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePluginsMarketplace } from '../hooks/usePluginsMarketplace';
import { PluginCard, MarketplaceErrorCard } from './PluginCard';

interface PluginsMarketplaceViewProps {
  refreshTrigger?: number;
}

export function PluginsMarketplaceView({ refreshTrigger = 0 }: PluginsMarketplaceViewProps) {
  const {
    marketplaces,
    errors,
    isLoading,
    installingPluginId,
    handleInstall,
    handleUsePlugin,
    handleShowDetail,
    browseGroups,
  } = usePluginsMarketplace(refreshTrigger);


  if (isLoading) {
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
        {browseGroups.map(([category, items]) => (
          <section key={category} className="space-y-3">
            <h2 className="text-sm font-semibold">{category}</h2>

            <div className="grid gap-4 md:grid-cols-2">
              {items.map(({ marketplace, plugin }) => (
                <PluginCard
                  key={plugin.id}
                  plugin={plugin}
                  isInstalling={installingPluginId === plugin.id}
                  canInstall={!!marketplace.path}
                  onInstall={() => handleInstall(marketplace, plugin)}
                  onUse={() => handleUsePlugin(plugin)}
                  onDetail={() => handleShowDetail(marketplace, plugin)}
                />
              ))}
            </div>
          </section>
        ))}

        {errors.map((error) => (
          <MarketplaceErrorCard key={`${error.marketplacePath}-${error.message}`} error={error} />
        ))}
      </div>
    </div>
  );
}
