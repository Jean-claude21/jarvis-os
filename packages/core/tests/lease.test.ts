import { describe, expect, it } from 'vitest';
import { giveLease, lastPass, takeLease } from '../src';
import { db } from './people';

// Spec 021: one watcher at a time on a database, a lease left behind expires, the last pass is read.
describe('the watcher lease', () => {
  const name = `trial-${Date.now()}`;

  it('is held by one watcher at a time, then by the next', async () => {
    expect(await takeLease(db, name, 'laptop:1')).toBe(true);
    expect(await takeLease(db, name, 'netlify:2')).toBe(false);
    expect(await giveLease(db, name, 'netlify:2', { report: {} })).toBe(false);
    expect(await giveLease(db, name, 'laptop:1', { report: { sent: 2 } })).toBe(true);
    expect(await lastPass(db, name)).toMatchObject({ holder: 'laptop:1', report: { sent: 2 } });
    expect(await takeLease(db, name, 'netlify:2')).toBe(true);
    await giveLease(db, name, 'netlify:2', { error: 'database unreachable' });
    expect(await lastPass(db, name)).toMatchObject({
      holder: 'netlify:2',
      error: 'database unreachable',
      report: null,
    });
  });

  it('expires by itself when its holder stops in the middle', async () => {
    const left = `${name}-left`;
    expect(await takeLease(db, left, 'laptop:1', 1)).toBe(true);
    expect(await takeLease(db, left, 'netlify:2')).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(await takeLease(db, left, 'netlify:2')).toBe(true);
  });

  it('is not readable by the application, only through its functions', async () => {
    await expect(db.query('select * from watcher_lease')).rejects.toThrow(/permission/);
  });
});
