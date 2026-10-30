import { beforeAll, describe, expect, it } from 'vitest';
import { rruleOf } from '../src/ics';
import { weekStart } from '../src/routes';
import { server, signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 011: one calendar, read by Claude (`agenda`), the app (`/api/agenda`) and her phone (iCal).
let ama: Account;
let claude: Connected;

beforeAll(async () => {
  ama = await signUp('Ama');
  await ama.json('/api/save', {
    entries: [
      {
        kind: 'Événement',
        title: 'Dentiste',
        data: { start: '2026-10-29T14:00', end: '2026-10-29T15:00' },
      },
      {
        kind: 'Habitude',
        title: 'Gym, mardi et mercredi',
        data: { repeat: '30 18 * * 2,3', duration: 90 },
      },
      { kind: 'Obligation', title: 'Frais de dossier', data: { due: '2026-10-31' } },
      {
        kind: 'Créneau',
        title: 'Mémoire',
        data: { start: '2026-10-30T16:00', end: '2026-10-30T18:00', status: 'proposed' },
      },
    ],
  });
  // Dated from today: the subscription reaches a month back and eleven ahead.
  const soon = (days: number) =>
    new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  await ama.json('/api/save', {
    entries: [
      { kind: 'Obligation', title: 'Passeport', data: { due: soon(20) } },
      {
        kind: 'Créneau',
        title: 'Relire le chapitre',
        data: { start: `${soon(12)}T16:00`, duration: 120, status: 'proposed' },
      },
    ],
  });
  claude = await connect(ama);
});

describe('her calendar in Claude', () => {
  it('answers « what do I have Thursday? » from the entries, whatever their kind', async () => {
    const thursday = await claude.call<{ title: string; type: string }[]>('agenda', {
      from: '2026-10-29',
      to: '2026-10-29',
    });
    expect(thursday.value.map((one) => [one.title, one.type])).toEqual([['Dentiste', 'span']]);
    const week = await claude.call<{ title: string; proposed: boolean }[]>('agenda', {
      from: '2026-10-26',
      to: '2026-11-01',
    });
    expect(week.value.map((one) => one.title)).toEqual([
      'Gym, mardi et mercredi',
      'Gym, mardi et mercredi',
      'Dentiste',
      'Mémoire',
      'Frais de dossier',
    ]);
    expect(week.value.find((one) => one.title === 'Mémoire')?.proposed).toBe(true);
    const wrong = await claude.call<{ error: string }>('agenda', {
      from: 'jeudi prochain',
      to: '2026-10-29',
    });
    expect(wrong.isError).toBe(true);
  });
});

describe('her calendar in the app', () => {
  it('starts a week on Monday at midnight in Paris', () => {
    expect(weekStart(new Date('2026-10-30T09:41:00Z'))).toBe('2026-10-25T23:00:00.000Z');
    expect(weekStart(new Date('2026-10-25T22:30:00Z'))).toBe('2026-10-18T22:00:00.000Z');
  });

  it('gives the occurrences of a window, and whether her phone is linked', async () => {
    const { body } = await ama.json<{ occurrences: { title: string }[]; linked: boolean }>(
      '/api/agenda?from=2026-10-25T23:00:00Z&to=2026-11-01T23:00:00Z',
    );
    expect(body.occurrences).toHaveLength(5);
    expect(body.linked).toBe(false);
    expect((await ama.call('/api/agenda?from=demain')).status).toBe(400);
  });
});

describe('her calendar in her phone', () => {
  it('serves iCalendar at a private address, until she renews it', async () => {
    const { body: address } = await ama.json<{ url: string; webcal: string }>(
      '/api/agenda/address',
      {},
    );
    expect(address.webcal.startsWith('webcal:')).toBe(true);
    const path = new URL(address.url).pathname;
    const feed = await server.app.request(path);
    expect(feed.status).toBe(200);
    expect(feed.headers.get('content-type')).toContain('text/calendar');
    const ics = await feed.text();
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Gym\\, mardi et mercredi');
    expect(ics).toContain('SUMMARY:Proposé · Relire le chapitre');
    expect(ics).toContain('STATUS:TENTATIVE');
    expect(ics).toMatch(/DTSTART;VALUE=DATE:\d{8}\r\nDTEND;VALUE=DATE:\d{8}\r\nSUMMARY:Passeport/);
    // The habit goes once, with its rule: her phone repeats it.
    expect(ics.match(/SUMMARY:Gym/g)).toHaveLength(1);
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU,WE');
    expect(ics).toContain('DURATION:PT90M');
    expect(ics.split('\r\n').every((line) => Buffer.byteLength(line) <= 75)).toBe(true);
    expect((await ama.json<{ linked: boolean }>('/api/agenda')).body.linked).toBe(true);

    await ama.json('/api/agenda/address', {});
    expect((await server.app.request(path)).status).toBe(404);
    expect((await server.app.request('/agenda/nothing.ics')).status).toBe(404);
  });
});

describe('a repetition her phone repeats itself', () => {
  it('turns the five fields into an RRULE when it can, and says when it cannot', () => {
    expect(rruleOf('30 4 * * *')?.rule).toBe('FREQ=DAILY');
    expect(rruleOf('45 20 * * 0-5')?.rule).toBe('FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH,FR');
    expect(rruleOf('30 19 L * *')?.rule).toBe('FREQ=MONTHLY;BYMONTHDAY=-1');
    expect(rruleOf('0 9 1 11 *')?.rule).toBe('FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=1');
    expect(rruleOf('*/5 * * * *')).toBeNull();
    expect(rruleOf('0 9,18 * * *')).toBeNull();
  });
});
