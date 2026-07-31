import type { SkillsListResponse } from '@/bindings/v2';

import { dual, type InstalledSkillItem, type MarketplaceSkillItem, type SkillScope } from './shared';

export type MarketSkillItem = {
  id: string;
  source: string;
  skillId: string;
  name: string;
  installs: number;
};

export type CentralSkillItem = {
  name: string;
  path: string;
  description?: string | null;
  linkedCodex: boolean;
  linkedCc: boolean;
};

export async function skillList(cwd: string) {
  return await dual<SkillsListResponse>('skills_list', { cwd }, '/api/codex/skills/list', {
    cwds: [cwd],
  });
}

export async function cloneSkillsRepo(url: string) {
  return await dual<string>('clone_skills_repo', { url }, '/api/skills/clone-repo', { url });
}

export async function listMarketplaceSkills() {
  return await dual<Array<MarketplaceSkillItem>>(
    'list_marketplace_skills',
    undefined,
    '/api/skills/list-marketplace',
    {}
  );
}

export async function listCentralSkills(scope: SkillScope, cwd?: string) {
  return await dual<Array<CentralSkillItem>>(
    'list_central_skills',
    { scope, cwd },
    '/api/skills/list-central',
    { scope, cwd }
  );
}

export async function listInstalledSkills(selectedAgent: string, scope: SkillScope, cwd?: string) {
  return await dual<Array<InstalledSkillItem>>(
    'list_installed_skills',
    { selectedAgent, scope, cwd },
    '/api/skills/list-installed',
    { selected_agent: selectedAgent, scope, cwd }
  );
}

export async function installMarketplaceSkill(
  skillMdPath: string,
  skillName: string,
  selectedAgent: string,
  scope: SkillScope,
  cwd?: string
) {
  return await dual<string>(
    'install_marketplace_skill',
    { skillMdPath, skillName, selectedAgent, scope, cwd },
    '/api/skills/install-marketplace',
    {
      skill_md_path: skillMdPath,
      skill_name: skillName,
      selected_agent: selectedAgent,
      scope,
      cwd,
    }
  );
}

export async function linkSkillToAgent(
  skillName: string,
  agent: string,
  scope: SkillScope,
  cwd?: string
) {
  return await dual<void>(
    'link_skill_to_agent',
    { skillName, agent, scope, cwd },
    '/api/skills/link-to-agent',
    { skill_name: skillName, agent, scope, cwd }
  );
}

export async function uninstallInstalledSkill(
  skillName: string,
  selectedAgent: string,
  scope: SkillScope,
  cwd?: string
) {
  return await dual<string>(
    'uninstall_installed_skill',
    { skillName, selectedAgent, scope, cwd },
    '/api/skills/uninstall-installed',
    { skill_name: skillName, selected_agent: selectedAgent, scope, cwd }
  );
}

export async function deleteCentralSkill(skillName: string, scope: SkillScope, cwd?: string) {
  return await dual<void>(
    'delete_central_skill',
    { skillName, scope, cwd },
    '/api/skills/delete-central',
    { skill_name: skillName, scope, cwd }
  );
}

export async function fetchMarketLeaderboard(board: 'alltime' | 'trending' | 'hot') {
  return await dual<Array<MarketSkillItem>>(
    'fetch_market_leaderboard',
    { board },
    '/api/skillssh/leaderboard',
    { board }
  );
}

export async function searchMarketSkills(query: string, limit = 40) {
  return await dual<Array<MarketSkillItem>>(
    'search_market_skills',
    { query, limit },
    '/api/skillssh/search',
    { query, limit }
  );
}

export async function installFromMarket(
  source: string,
  skillId: string,
  scope: SkillScope,
  cwd?: string
) {
  return await dual<string>(
    'install_from_market',
    { source, skillId, scope, cwd },
    '/api/skillssh/install',
    { source, skill_id: skillId, scope, cwd }
  );
}

export type SkillGroup = { id: string; name: string; skillNames: string[] };
export type SkillGroupsConfig = { groups: SkillGroup[] };

export async function readSkillGroups(): Promise<SkillGroupsConfig> {
  return await dual<SkillGroupsConfig>('read_skill_groups', {}, '/api/skills/groups/read', {});
}

export async function writeSkillGroups(config: SkillGroupsConfig): Promise<void> {
  return await dual<void>('write_skill_groups', { config }, '/api/skills/groups/write', { config });
}

export async function skillsConfigWrite(path: string, enabled: boolean) {
  return await dual('skills_config_write', { path, enabled }, '/api/codex/skills/config/write', {
    path,
    enabled,
  });
}
