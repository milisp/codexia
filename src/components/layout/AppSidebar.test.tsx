import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayoutStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { useBotUiStore } from '@/stores/useBotUiStore';

const createBot = vi.fn();
const updateBot = vi.fn();
const createAutomation = vi.fn();

vi.mock('@/services/apiAdapt/bots', () => ({
  listBots: vi.fn().mockResolvedValue([]),
  createBot: (...args: unknown[]) => createBot(...args),
  listBotSessions: vi.fn().mockResolvedValue([]),
  updateBot: (...args: unknown[]) => updateBot(...args),
  deleteBot: vi.fn(),
  parseBotList: () => [],
}));

vi.mock('@/services/apiAdapt/automation', () => ({
  createAutomation: (...args: unknown[]) => createAutomation(...args),
}));
vi.mock('@/services/apiAdapt/kekeMcp', () => ({
  readKekeMcpServers: vi.fn().mockResolvedValue({ 'github-mcp': { command: 'gh-mcp' } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/bot/BotSettingsDialog', () => ({ BotSettingsDialog: () => null }));
vi.mock('@/components/bot', () => ({ SideBarBotPane: () => null }));
vi.mock('@/components/bot/BotNotifications', () => ({ BotNotifications: () => null }));
vi.mock('@/components/pairing/DesktopDrawer', () => ({ DesktopDrawer: () => null }));
vi.mock('@/hooks', () => ({ useTrafficLightConfig: () => ({ isMacos: false }) }));
vi.mock('@/hooks/runtime', () => ({ isPhone: () => false }));
vi.mock('@/features/UpdateIndicator', () => ({ UpdateIndicator: () => null }));
vi.mock('../common/SessionManagerDialog', () => ({ SessionManagerDialog: () => null }));
vi.mock('./SideBarAgentPane', () => ({
  SideBarAgentHeader: () => null,
  SideBarAgentList: () => null,
  SideBarProjectActions: () => null,
}));
vi.mock('./SideBarPinnedList', () => ({ SideBarPinnedList: () => null }));
vi.mock('./UserInfo', () => ({ UserInfo: () => null }));

import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSideBar } from './AppSidebar';

beforeEach(() => {
  vi.clearAllMocks();
  useAcpStore.getState().reset();
  useBotUiStore.setState({ bots: [], selectedBotId: null, connectionByBot: {}, sessionByBot: {} });
});

describe('AppSideBar', () => {
  it('opens the Bots view without creating a bot', () => {
    useLayoutStore.setState({ view: 'agent' });
    render(<SidebarProvider><AppSideBar /></SidebarProvider>);
    fireEvent.click(screen.getByRole('button', { name: /^Bots$/ }));
    expect(useLayoutStore.getState().view).toBe('bot');
    expect(screen.getByRole('button', { name: 'Collapse bots' })).toBeTruthy();
    expect(createBot).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse bots' }));
    expect(useLayoutStore.getState().view).toBe('bot');
  });

  it('clears the pane when a bot is created, so the previous bot does not appear to be it', async () => {
    createBot.mockImplementation(async (bot: Record<string, unknown>) => ({
      ...bot,
      title: null,
      agentId: 'keke',
      provider: null,
      model: null,
      reasoningEffort: null,
      systemPrompt: null,
      trustLevel: 'ask',
      approvedTools: '[]',
      mcpServers: '[]',
      pinned: false,
      archived: false,
      notificationsEnabled: true,
      unreadCount: 0,
      lastViewedAt: null,
      createdAt: '',
      updatedAt: new Date().toISOString(),
    }));
    // What the previously open bot left in the shared ACP store.
    useAcpStore.getState().setEntries([{ id: 'a', role: 'agent', text: 'bot1 was talking' }]);

    render(
      <SidebarProvider>
        <AppSideBar />
      </SidebarProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'newBot' }));
    expect(createBot).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: /Blank bot/ }));

    await waitFor(() => expect(useAcpStore.getState().entries).toEqual([]));
    expect(useBotUiStore.getState().selectedBotId).toBeTruthy();
    expect(updateBot).not.toHaveBeenCalled();
    expect(createAutomation).not.toHaveBeenCalled();
  });

  it('creates a bot from a role with its connected tools and its routine', async () => {
    createBot.mockImplementation(async (bot: Record<string, unknown>) => ({ ...bot, agentId: 'keke' }));
    updateBot.mockImplementation(async (id: string, patch: Record<string, unknown>) => ({
      id,
      agentId: 'keke',
      ...patch,
    }));
    render(
      <SidebarProvider>
        <AppSideBar />
      </SidebarProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'newBot' }));
    // GitHub is configured, so the role shows it as connected, not as a link.
    expect(await screen.findAllByText('GitHub ✓')).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Use PR Reviewer' }));

    await waitFor(() => expect(createAutomation).toHaveBeenCalled());
    expect(createBot).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'PR Reviewer', avatar: '🔍', trustLevel: 'read_only' })
    );
    expect(updateBot).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ title: 'Reviews open pull requests', mcpServers: ['keke:github-mcp'] })
    );
    expect(createAutomation).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Morning PR review', agent: 'bot', projects: [] })
    );
  });
});
