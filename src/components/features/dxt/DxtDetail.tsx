import { UserConfigForm, Footer, ToolPrompt } from '@/components/features/dxt';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { DxtManifestSchema } from './schemas';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { MCPConfigType } from '@/types/cc/cc-mcp';
import { useWorkspaceStore, usePluginStore } from '@/stores';
import {
  loadManifest,
  unifiedAddMcpServer,
  unifiedDisableMcpServer,
  unifiedEnableMcpServer,
  unifiedReadMcpConfig,
  unifiedRemoveMcpServer,
} from '@/services';
import { Plus } from 'lucide-react';

// Helper function to validate URLs
function isValidUrl(url: any): boolean {
  if (typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Helper function to clean user_config
function cleanUserConfig(userConfig: any): any {
  if (typeof userConfig !== 'object' || !userConfig) return {};

  const cleaned: any = {};
  for (const [key, value] of Object.entries(userConfig)) {
    if (typeof value === 'object' && value !== null) {
      // Clean up nested config objects, ensuring required fields
      const cleanedValue: any = {
        type: (value as any).type || 'string', // Default type
        title: (value as any).title || key, // Use key as title if not provided
        description: (value as any).description || `Configuration for ${key}`, // Default description
        default: (value as any).default,
        required: (value as any).required,
        multiple: (value as any).multiple,
        sensitive: (value as any).sensitive,
        min: (value as any).min,
        max: (value as any).max,
      };

      // Remove undefined values
      Object.keys(cleanedValue).forEach((k) => {
        if (cleanedValue[k] === undefined) {
          delete cleanedValue[k];
        }
      });

      cleaned[key] = cleanedValue;
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

// Add this helper function to sanitize manifest fields that may be null
function sanitizeManifest(raw: any) {
  // Clean up null values
  for (const key in raw) {
    if (raw[key] === null) raw[key] = undefined;
  }

  // Fix common data issues
  const cleaned = {
    ...raw,
    // Ensure required fields have default values
    version: raw.version || raw.dxt_version || raw.server?.version || '1.0.0', // Use various fallbacks
    tools_generated: raw.tools_generated ?? false,
    prompts_generated: raw.prompts_generated ?? false,

    // Fix invalid URLs
    homepage: isValidUrl(raw.homepage) ? raw.homepage : undefined,
    documentation: isValidUrl(raw.documentation) ? raw.documentation : undefined,
    support: isValidUrl(raw.support) ? raw.support : undefined,

    // Clean up user_config if it exists
    user_config: raw.user_config ? cleanUserConfig(raw.user_config) : undefined,
  };

  // Remove unrecognized top-level fields that might cause issues
  const allowedFields = new Set([
    'id',
    'name',
    'display_name',
    'description',
    'author',
    'homepage',
    'icon',
    'dxt_version',
    'version',
    'server',
    'tools',
    'prompts',
    'resources',
    'user_config',
    'tools_generated',
    'prompts_generated',
    'compatibility',
    'source',
    'documentation',
    'support',
    'long_description',
    'repository',
    'screenshots',
    'keywords',
    'license',
    '$schema',
  ]);

  const filtered: any = {};
  for (const [key, value] of Object.entries(cleaned)) {
    if (allowedFields.has(key)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

export default function DxtDetail({ user, repo }: { user: string; repo: string }) {
  const { cwd, selectedAgent } = useWorkspaceStore();
  const { mcpScope: selectedScope } = usePluginStore();
  const [manifest, setManifest] = useState<z.infer<typeof DxtManifestSchema> | null>(null);
  const [userConfig, setUserConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installedScope, setInstalledScope] = useState<string | null>(null);

  // First useEffect: load manifest
  useEffect(() => {
    if (!user || !repo) {
      console.log('Missing user or repo:', { user, repo });
      return;
    }

    console.log('Loading manifest for:', { user, repo });
    setLoading(true);

    loadManifest(user, repo)
      .then((found) => {
        console.log('Manifest loaded:', found);
        if (found) {
          try {
            const sanitized = sanitizeManifest(found);
            console.log('Sanitized manifest:', sanitized);
            const parsed = DxtManifestSchema.parse(sanitized);
            setManifest(parsed);
          } catch (e) {
            console.error('Failed to parse manifest:', e, found);
            setManifest(null);
          }
        } else {
          console.log('No manifest found for:', { user, repo });
          setManifest(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load manifest:', err, { user, repo });
        setManifest(null);
        setLoading(false);
      });
  }, [user, repo]);

  // Second useEffect: check mcpServers after manifest is loaded
  useEffect(() => {
    checkInstallation();
  }, [manifest, selectedAgent, cwd]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (!manifest) return <div className="p-4">Not found</div>;

  const userConfigSchema = manifest.user_config ?? {};

  // Helper to merge userConfig into mcp_config
  function getMergedMcpConfig() {
    const baseConfig = JSON.parse(JSON.stringify(manifest?.server.mcp_config || {}));
    // If there's an env object, update it with matching userConfig keys
    if (baseConfig.env && typeof baseConfig.env === 'object') {
      for (const [k, v] of Object.entries(userConfig)) {
        if (k in baseConfig.env) {
          baseConfig.env[k] = v;
        } else {
          baseConfig[k] = v;
        }
      }
    } else {
      // No env object, just shallow merge
      Object.assign(baseConfig, userConfig);
    }
    return baseConfig;
  }

  async function addMcpConfig() {
    if (!manifest) return;
    const mergedConfig = getMergedMcpConfig();

    // For Codex, path is always undefined (uses ~/.codex/config.toml)
    // For CC, path is required and comes from cwd
    const _item = {
      clientName: selectedAgent,
      path: selectedAgent === 'codex' ? undefined : (cwd ?? undefined),
      serverName: manifest.name,
      serverConfig: mergedConfig,
      scope: selectedAgent === 'cc' ? selectedScope : undefined,
    };
    console.log(_item);
    try {
      await unifiedAddMcpServer(_item);
      // Trigger refresh
      checkInstallation();
    } catch (e) {
      console.error('Failed to add MCP server:', e);
    }
  }

  async function removeMcpServer() {
    if (!manifest) return;

    const configPath = selectedAgent === 'codex' ? undefined : (cwd ?? undefined);

    try {
      await unifiedRemoveMcpServer({
        clientName: selectedAgent,
        path: configPath,
        serverName: manifest.name,
        scope: selectedAgent === 'cc' ? (installedScope ?? undefined) : undefined,
      });
      // Trigger refresh
      checkInstallation();
    } catch (e) {
      console.error('Failed to remove MCP server:', e);
    }
  }

  function checkInstallation() {
    if (!manifest) return;
    const configPath = selectedAgent === 'codex' ? undefined : (cwd ?? undefined);
    if (selectedAgent === 'cc' && !configPath) {
      setIsInstalled(false);
      setEnabled(false);
      return;
    }

    unifiedReadMcpConfig(selectedAgent, configPath)
      .then((savedData) => {
        const typedSavedData = savedData as MCPConfigType;
        const serverConfig = typedSavedData.mcpServers?.[manifest.name];
        const hasServer = !!serverConfig;
        setIsInstalled(hasServer);
        if (hasServer && serverConfig) {
          const isEnabled = serverConfig.enabled !== false;
          setEnabled(isEnabled);
          setInstalledScope(serverConfig.scope || null);
        } else {
          setEnabled(false);
          setInstalledScope(null);
        }
      })
      .catch((error) => {
        console.error('Failed to read MCP config:', error);
        setIsInstalled(false);
        setEnabled(false);
      });
  }
  async function changeStatus(checked: boolean) {
    if (!manifest) return;
    setEnabled(checked);
    const mergedConfig = getMergedMcpConfig();
    const mcpServerConfig = { [manifest.name]: mergedConfig };
    console.log(mcpServerConfig);

    // For Codex, path is always undefined (uses ~/.codex/config.toml)
    // For CC, path is required and comes from cwd
    const configPath = selectedAgent === 'codex' ? undefined : (cwd ?? undefined);

    if (checked) {
      unifiedDisableMcpServer({
        clientName: selectedAgent,
        path: configPath,
        serverName: manifest.name,
      });
    } else {
      const _serverItem = {
        clientName: selectedAgent,
        path: configPath,
        serverName: manifest.name,
      };
      try {
        await unifiedEnableMcpServer(_serverItem);
      } catch (error) {}
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2">
        <h1 className="text-2xl font-bold mb-2">{manifest.display_name ?? manifest.name}</h1>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-2">
        {/* Top section */}
        <div className="flex justify-between items-start mb-6">
          <p className="text-gray-700 dark:text-gray-300 mb-1">{manifest.description}</p>
        </div>

        <div className="mb-6 border rounded-xl overflow-hidden bg-card shadow-sm">
          <div className="p-4 space-y-6">
            {/* Enable/Disable and Add button */}
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-3">
                  <Switch onCheckedChange={changeStatus} checked={enabled} />
                  <span className="text-sm font-medium">{enabled ? 'Enabled' : 'Disabled'}</span>
                  {installedScope && (
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                      {installedScope}
                    </span>
                  )}
                </span>
                {!isInstalled && (
                  <p className="text-[10px] text-muted-foreground">
                    The server is not yet configured for this agent/path.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4">
                {isInstalled && (
                  <Button variant="destructive" onClick={removeMcpServer}>
                    Remove
                  </Button>
                )}
                {!isInstalled && (
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      onClick={addMcpConfig}
                      disabled={selectedAgent === 'cc' && !cwd}
                      className="px-8"
                    >
                      <Plus className="h-4 w-4" /> Add to{' '}
                      {selectedAgent === 'codex' ? 'Codex' : 'Claude Code'}
                    </Button>
                    {selectedAgent === 'cc' && !cwd && (
                      <p className="text-[10px] text-destructive font-medium underline underline-offset-2">
                        Please select a project scope first
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* User config form */}
        {Object.keys(userConfigSchema).length > 0 && (
          <div className="mb-8 rounded">
            <h2 className="text-lg font-semibold mb-2">User Configuration</h2>
            <UserConfigForm
              schema={userConfigSchema}
              values={userConfig}
              onChange={(k, v) => setUserConfig((prev) => ({ ...prev, [k]: v }))}
            />
          </div>
        )}

        {/* Middle section: tools & prompts */}
        <ToolPrompt manifest={manifest} />

        <Footer manifest={manifest} />
      </div>
    </div>
  );
}
