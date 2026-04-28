import { Codex, ClaudeCode, Gemini } from '@/components/icons';
import type { ReactNode } from 'react';

export type Range = 'day' | 'week' | 'month' | 'year' | 'all';
export type AgentKey = 'claude' | 'codex' | 'gemini';

export const RANGES: { label: string; value: Range }[] = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
  { label: 'All', value: 'all' },
];

export const AGENT_CONFIG: Record<AgentKey, { label: string; color: string; icon: ReactNode }> = {
  claude: { label: 'Claude', color: '#a78bfa', icon: <ClaudeCode /> },
  codex: { label: 'Codex', color: '#34d399', icon: <Codex /> },
  gemini: { label: 'Gemini', color: '#60a5fa', icon: <Gemini /> },
};

export interface ModelPricing {
  input: number;
  output: number;
  cache_read: number;
  cache_creation: number;
}
