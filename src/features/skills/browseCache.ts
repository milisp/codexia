import type { MarketSkillItem } from '@/services';

export type BoardType = 'alltime' | 'trending' | 'hot';

// Module-level cache — lives outside BrowseTab so HMR of BrowseTab.tsx doesn't reset it.
export const leaderboardCache: Partial<Record<BoardType, MarketSkillItem[]>> = {};
export const searchCache = new Map<string, MarketSkillItem[]>();
