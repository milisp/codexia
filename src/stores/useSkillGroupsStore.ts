import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SkillGroup = {
  id: string;
  name: string;
  skillNames: string[];
};

type SkillGroupsState = {
  groups: SkillGroup[];
  addGroup: (name: string) => string;
  renameGroup: (id: string, name: string) => void;
  removeGroup: (id: string) => void;
  addSkillToGroup: (groupId: string, skillName: string) => void;
  removeSkillFromGroup: (groupId: string, skillName: string) => void;
  moveSkill: (skillName: string, fromGroupId: string | null, toGroupId: string) => void;
};

export const useSkillGroupsStore = create<SkillGroupsState>()(
  persist(
    (set) => ({
      groups: [],

      addGroup: (name) => {
        const id = nanoid(8);
        set((s) => ({ groups: [...s.groups, { id, name, skillNames: [] }] }));
        return id;
      },

      renameGroup: (id, name) =>
        set((s) => ({
          groups: s.groups.map((g) => (g.id === id ? { ...g, name } : g)),
        })),

      removeGroup: (id) => set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),

      addSkillToGroup: (groupId, skillName) =>
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId && !g.skillNames.includes(skillName)
              ? { ...g, skillNames: [...g.skillNames, skillName] }
              : g
          ),
        })),

      removeSkillFromGroup: (groupId, skillName) =>
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId ? { ...g, skillNames: g.skillNames.filter((n) => n !== skillName) } : g
          ),
        })),

      moveSkill: (skillName, fromGroupId, toGroupId) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id === fromGroupId) {
              return { ...g, skillNames: g.skillNames.filter((n) => n !== skillName) };
            }
            if (g.id === toGroupId && !g.skillNames.includes(skillName)) {
              return { ...g, skillNames: [...g.skillNames, skillName] };
            }
            return g;
          }),
        })),
    }),
    { name: 'skill-groups' }
  )
);
