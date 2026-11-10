import { beforeAll, describe, expect, it } from 'vitest';
import { capture, find, get, keepReview, mirrorOf, save, setPreferences } from '../src';
import { person, type Person } from './people';

// Spec 043: her questions, the mirror Jarvis prepares, her decisions turned into tasks.
describe('her review', () => {
  let ama: Person;

  beforeAll(async () => {
    ama = await person('Ama');
  });

  it('prepares the mirror of a week with her own questions', async () => {
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          { kind: 'Task', title: 'Envoyer le devis', data: { status: 'done' } },
          {
            kind: 'Transaction',
            title: 'Courses',
            data: { amount: 12000, direction: 'out', date: '2026-11-09' },
          },
        ],
      }),
    );
    await ama.as((tx) =>
      capture(tx, ama.actor, ama.space, {
        text: 'Je vais réparer le vélo',
        source: 'app',
        at: '2026-11-01T08:00:00.000Z',
      }),
    );
    await ama.as((tx) =>
      setPreferences(tx, ama.actor, { review: { questions: ['Ai-je assez dormi ?'] } }),
    );
    const from = new Date(Date.now() - 7 * 86_400_000);
    const to = new Date(Date.now() + 60_000);
    const mirror = await ama.as((tx) => mirrorOf(tx, [ama.space], from, to));
    expect(mirror.questions).toEqual(['Ai-je assez dormi ?']);
    expect(mirror.done.map((one) => one.title)).toContain('Envoyer le devis');
    expect(mirror.made.map((one) => one.kind)).toEqual(
      expect.arrayContaining(['Task', 'Transaction']),
    );
    expect(mirror.intentions.map((one) => one.title)).toContain('Réparer le vélo');
  });

  it('shows her habits day by day, her commitments, her spending by fund and what she said', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          { ref: 'h', kind: 'Habit', title: 'Lecture', data: { days: 'tous les jours' } },
          { ref: 'r', kind: 'Lecture', title: 'Lu 20 pages', data: { date: yesterday } },
          { kind: 'Task', title: 'Rendre le livre', data: { status: 'open', due: yesterday } },
          { ref: 'f', kind: 'Fund', title: 'Libre' },
          {
            ref: 't',
            kind: 'Transaction',
            title: 'Taxi',
            data: { amount: 3000, direction: 'out', date: today },
          },
          { kind: 'Journal', title: 'Soir', data: { text: 'Bonne journée, calme.' } },
        ],
        links: [{ from: 't', to: 'f', role: 'fund' }],
      }),
    );
    const from = new Date(Date.now() - 6 * 86_400_000);
    const to = new Date(Date.now() + 86_400_000);
    const mirror = await ama.as((tx) => mirrorOf(tx, [ama.space], from, to));
    const lecture = mirror.habits.find((one) => one.title === 'Lecture')!;
    expect(lecture.days.find((one) => one.day === yesterday)!.state).toBe('done');
    expect(lecture.kept).toBe(1);
    expect(mirror.commitments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Rendre le livre', state: 'late' }),
      ]),
    );
    expect(mirror.spending.find((one) => one.name === 'Libre')!.now).toBe(3000);
    expect(mirror.said.map((one) => one.text)).toContain('Bonne journée, calme.');
  });

  it('keeps her answers and turns each decision into a task linked to the review', async () => {
    const kept = await ama.as((tx) =>
      keepReview(tx, ama.actor, ama.space, {
        title: 'Revue du 10 novembre',
        from: '2026-11-03',
        to: '2026-11-10',
        answers: [{ question: 'Ai-je assez dormi ?', answer: 'Non, trop tard le soir.' }],
        decisions: [{ text: 'Couper les écrans à 22h', due: '2026-11-11' }],
      }),
    );
    const review = await ama.as((tx) => get(tx, ama.space, kept.entries[0]!.id));
    expect(review!.data.answers).toHaveLength(1);
    expect(review!.links.in.map((one) => [one.role, one.entry.title])).toEqual([
      ['decided_in', 'Couper les écrans à 22h'],
    ]);
    const [task] = await ama.as((tx) => find(tx, ama.space, { kind: 'Task', text: 'écrans' }));
    expect(task!.data).toMatchObject({ status: 'open', due: '2026-11-11' });
  });
});
