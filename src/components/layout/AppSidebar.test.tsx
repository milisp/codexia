import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAcpStore } from '@/stores/useAcpStore';
import { useBotUiStore } from '@/stores/useBotUiStore';

const createBot = vi.fn();

vi.mock('@/services/apiAdapt/bots', () => ({
  listBots: vi.fn().mockResolvedValue([]),
  createBot: (...args: unknown[]) => createBot(...args),
  listBotSessions: vi.fn().mockResolvedValue([]),
  updateBot: vi.fn(),
  deleteBot: vi.fn(),
  parseBotList: () => [],
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

    await waitFor(() => expect(useAcpStore.getState().entries).toEqual([]));
    expect(useBotUiStore.getState().selectedBotId).toBeTruthy();
  });
});
