import { describe, expect, it } from 'vitest';
import type { Project } from '@/bindings/v2';
import { sortByRecency, sortByRecentUse } from './projectRecency';

const project = (id: string, recencyAt: number | null): Project => ({
  id,
  name: id,
  roots: [],
  metadata: {},
  position: 0,
  createdAt: 0,
  updatedAt: 0,
  recencyAt,
});

describe('projectRecency', () => {
  it('puts recently used paths first and keeps the rest in order', () => {
    expect(sortByRecentUse(['/a', '/b', '/c', '/d'], ['/c', '/x', '/a'])).toEqual([
      '/c',
      '/a',
      '/b',
      '/d',
    ]);
  });

  it('orders server projects by newest chat, chatless ones last', () => {
    const sorted = sortByRecency([project('a', null), project('b', 10), project('c', 30)]);
    expect(sorted.map((p) => p.id)).toEqual(['c', 'b', 'a']);
  });
});
