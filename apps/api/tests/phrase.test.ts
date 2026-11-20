import { asPerson } from '@jarvis-os/core';
import { describe, expect, it } from 'vitest';
import { captureAs } from '../src/capture';
import { server, signUp } from './client';

// F6b on Telegram: a phrase says what it started — the automation and the agent that runs it, or
// the skill her assistant follows.
describe('a phrase from Telegram', () => {
  it('names the agent of an automation, and the skill to ask for', async () => {
    const ama = await signUp('Ama');
    const me = (await ama.json<{ person: { id: string }; space: { id: string } }>('/api/me')).body;
    await ama.json('/api/save', {
      entries: [
        {
          kind: 'Rule',
          title: 'Courses sur demande',
          data: {
            when: { phrase: '/courses' },
            then: [{ create: { kind: 'Task', title: 'Courses' } }],
            agent: 'Intendant',
          },
        },
        {
          kind: 'Routine',
          title: 'bilan-hebdo',
          data: { instructions: 'Écris mon bilan.', triggers: [{ phrase: '/bilan' }] },
        },
      ],
    });
    const said = (text: string) =>
      asPerson(server.db, me.person.id, (tx) =>
        captureAs(tx, { person: me.person.id, door: 'telegram' }, me.space.id, {
          text,
          source: 'telegram',
        }),
      );
    expect((await said('/courses samedi')).phrase).toEqual({
      kind: 'rule',
      title: 'Courses sur demande',
      phrase: '/courses',
      agent: 'Intendant',
    });
    expect((await said('/bilan')).phrase).toEqual({
      kind: 'skill',
      title: 'bilan-hebdo',
      phrase: '/bilan',
    });
    expect((await said('acheter du pain')).phrase).toBeUndefined();
  });
});
