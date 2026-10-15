import { describe, expect, it } from 'vitest';
import { BOT_TEMPLATES, matchingServers, scheduleLabel, templateServers } from './botTemplates';

describe('bot templates', () => {
  it('every role states where it stops and hands outward-facing work to the person', () => {
    for (const template of BOT_TEMPLATES) {
      expect(template.stopsAt).not.toBe('');
      expect(template.prompt).toContain('propose_draft');
      expect(template.prompt).toContain('hand_back');
    }
    expect(new Set(BOT_TEMPLATES.map((t) => t.id)).size).toBe(BOT_TEMPLATES.length);
  });

  it('resolves a role’s integrations to configured keke servers, one per need', () => {
    const inbox = BOT_TEMPLATES.find((t) => t.id === 'inbox-triage')!;
    const meeting = BOT_TEMPLATES.find((t) => t.id === 'meeting-prep')!;
    expect(templateServers(inbox, ['GitHub', 'gmail-work', 'gmail-home'])).toEqual(['keke:gmail-work']);
    expect(templateServers(meeting, ['google-calendar'])).toEqual(['keke:google-calendar']);
    expect(templateServers(inbox, [])).toEqual([]);
    const github = { kind: 'mcp' as const, label: 'GitHub', match: ['github'] };
    expect(matchingServers(github, ['my-GitHub', 'linear'])).toEqual(['my-GitHub']);
  });

  it('labels schedules the way the routines list does', () => {
    const base = { hour: 9, minute: 5, interval_hours: null };
    expect(scheduleLabel({ mode: 'daily', ...base, weekdays: [] })).toBe('Daily 09:05');
    expect(
      scheduleLabel({ mode: 'daily', ...base, weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'] })
    ).toBe('Weekdays 09:05');
    expect(scheduleLabel({ mode: 'daily', ...base, weekdays: ['fri'] })).toBe('Fridays 09:05');
    expect(scheduleLabel({ mode: 'interval', ...base, interval_hours: 2, weekdays: [] })).toBe(
      'Every 2 hours'
    );
  });
});
