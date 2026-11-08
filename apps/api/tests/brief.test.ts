import { describe, expect, it } from 'vitest';
import { briefText } from '../src/watcher';
import { signUp } from './client';

// Spec 018 through her account: the hour of her brief kept with her preferences; today's brief read
// now; not sent while she has no Telegram.
describe('the morning brief', () => {
  it('is set, read and refused without Telegram', async () => {
    const ama = await signUp('Ama');
    await ama.json('/api/save', {
      entries: [{ kind: 'Habitude', title: 'Lire', data: { days: '7/7' } }],
    });
    expect((await ama.json('/api/me/prefs', { brief: '07:30' })).body).toEqual({ brief: '07:30' });
    expect((await ama.json('/api/me/prefs', { brief: '7h30' })).status).toBe(400);
    const read = await ama.json<{ text: string; brief: { day: string } }>('/api/me/brief');
    expect(read.status).toBe(200);
    expect(read.body.text).toContain('☀️');
    expect((await ama.json<{ sent: boolean }>('/api/me/brief', {})).body).toEqual({ sent: false });
    expect((await ama.json('/api/me/prefs', { brief: null })).body).toEqual({ brief: null });
  });

  it('tells her day in a few lines', () => {
    const text = briefText({
      day: '2026-10-31',
      zone: 'Africa/Abidjan',
      fix: [],
      late: [
        {
          id: 'a',
          kind: 'Reminder',
          title: 'Payer le loyer',
          space: 'Moi',
          spaceId: 's',
          group: 'late',
          when: null,
          allDay: false,
          status: null,
          reason: 'late',
        },
      ],
      agenda: [],
      habits: [{ title: 'Prière', space: 'Moi', today: 'todo', rate30: 86.7 }],
    });
    expect(text).toContain('samedi 31 octobre');
    expect(text).toContain('• Payer le loyer');
    expect(text).toContain('○ Prière (à faire · 86,7 % sur 30 j)');
  });
});
