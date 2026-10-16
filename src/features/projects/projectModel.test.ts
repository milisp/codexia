import { describe, expect, it } from 'vitest';
import type { Project } from '@/bindings/v2';
import {
  findProjectForCwd,
  groupThreadsByProject,
  importKey,
  mirrorPaths,
  planProjectImports,
  primaryRoot,
  projectNameFromPath,
  rootsWith,
  rootsWithPrimary,
  rootsWithout,
  threadInScope,
} from './projectModel';

const project = (id: string, roots: string[], name = id): Project => ({
  id,
  name,
  roots: roots.map((path) => ({ path })),
  metadata: {},
  position: 0,
  createdAt: 0,
  updatedAt: 0,
  recencyAt: null,
});

describe('planProjectImports', () => {
  const projects = [project('a', ['/work/a', '/work/shared']), project('b', [])];

  it('keeps only local paths that are not a root of any server project', () => {
    expect(planProjectImports(['/work/a', '/work/c', '/work/shared'], projects)).toEqual([
      '/work/c',
    ]);
  });

  it('dedupes, trims and ignores trailing separators and blanks', () => {
    expect(planProjectImports(['/work/c/', '/work/c', ' /work/c ', '', '  '], projects)).toEqual([
      '/work/c',
    ]);
    expect(planProjectImports(['/work/a/'], projects)).toEqual([]);
  });

  it('plans nothing when the server already has every project', () => {
    expect(planProjectImports(['/work/a'], projects)).toEqual([]);
  });
});

describe('importKey', () => {
  it('is stable per path so a repeated import replays instead of duplicating', () => {
    expect(importKey('/work/c')).toBe(importKey('/work/c/'));
    expect(importKey('/work/c')).not.toBe(importKey('/work/d'));
  });
});

describe('roots', () => {
  const p = project('a', ['/one', '/two', '/three']);

  it('treats the first root as primary', () => {
    expect(primaryRoot(p)).toBe('/one');
    expect(primaryRoot(project('empty', []))).toBeNull();
  });

  it('moves a root to the front for "Make primary"', () => {
    expect(rootsWithPrimary(p, '/three')).toEqual(['/three', '/one', '/two']);
    expect(rootsWithPrimary(p, '/missing')).toEqual(['/one', '/two', '/three']);
  });

  it('adds a folder once and removes one', () => {
    expect(rootsWith(p, '/four/')).toEqual(['/one', '/two', '/three', '/four']);
    expect(rootsWith(p, '/two')).toEqual(['/one', '/two', '/three']);
    expect(rootsWithout(p, '/two')).toEqual(['/one', '/three']);
  });
});

describe('findProjectForCwd', () => {
  const projects = [
    project('outer', ['/work']),
    project('inner', ['/work/app']),
    project('multi', ['/other', '/work/lib']),
  ];

  it('prefers a primary root, then any root, then the deepest containing root', () => {
    expect(findProjectForCwd(projects, '/work/lib')?.id).toBe('multi');
    expect(findProjectForCwd(projects, '/work')?.id).toBe('outer');
    expect(findProjectForCwd(projects, '/work/app/src')?.id).toBe('inner');
    expect(findProjectForCwd(projects, '/work/other')?.id).toBe('outer');
  });

  it('does not match sibling folders that only share a prefix', () => {
    expect(findProjectForCwd(projects, '/workshop')).toBeNull();
  });

  it('returns null without a cwd', () => {
    expect(findProjectForCwd(projects, null)).toBeNull();
    expect(findProjectForCwd(projects, '')).toBeNull();
  });
});

describe('mirrorPaths', () => {
  it('lists primary roots in server order and skips folderless projects', () => {
    const projects = [project('a', ['/a', '/a2']), project('b', []), project('c', ['/c'])];
    expect(mirrorPaths(projects)).toEqual(['/a', '/c']);
  });
});

describe('thread grouping', () => {
  const projects = [project('a', ['/a']), project('b', ['/b'])];
  const threads = [
    { id: '1', projectId: 'a' },
    { id: '2', projectId: null },
    { id: '3', projectId: 'b' },
    { id: '4', projectId: 'deleted' },
    { id: '5', projectId: 'a' },
  ];

  it('groups by the server project and sends the rest to recent', () => {
    const { byProject, recent } = groupThreadsByProject(threads, projects);
    expect(byProject.get('a')?.map((t) => t.id)).toEqual(['1', '5']);
    expect(byProject.get('b')?.map((t) => t.id)).toEqual(['3']);
    expect(recent.map((t) => t.id)).toEqual(['2', '4']);
  });

  it('matches a thread to a project scope or to the unassigned scope', () => {
    expect(threadInScope({ projectId: 'a' }, 'a')).toBe(true);
    expect(threadInScope({ projectId: 'a' }, null)).toBe(false);
    expect(threadInScope({ projectId: null }, null)).toBe(true);
  });
});

describe('projectNameFromPath', () => {
  it('uses the last folder name', () => {
    expect(projectNameFromPath('/Users/me/code/app/')).toBe('app');
    expect(projectNameFromPath('C:\\code\\app')).toBe('app');
  });
});
