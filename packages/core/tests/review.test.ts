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
