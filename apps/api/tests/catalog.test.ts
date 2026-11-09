import { describe, expect, it } from 'vitest';
import { CATALOG, catalogFor, presetClientFor } from '../src/catalog';

// Spec 025, « Discover »: the everyday tools first, each with its logo or its initial on its colour;
// Google's wait for the client registered once, and use it when it is there.
describe('the catalog of tools', () => {
  it('puts the everyday tools first, Google Drive leading, each with a logo', () => {
    expect(CATALOG.slice(0, 3).map((one) => one.name)).toEqual([
      'Google Drive',
      'Gmail',
      'Google Agenda',
    ]);
    for (const entry of catalogFor({})) {
      expect(entry.logo.hex).toMatch(/^[0-9A-F]{6}$/i);
      expect(entry.logo.path ?? entry.logo.initial).toBeTruthy();
    }
    expect(new Set(CATALOG.map((one) => one.id)).size).toBe(CATALOG.length);
  });

  it('makes Google ready only with its client, and gives it with its scope', () => {
    const without = catalogFor({}).find((one) => one.id === 'google-drive')!;
    expect(without.ready).toBe(false);
    const env = { JARVIS_GOOGLE_CLIENT_ID: 'id', JARVIS_GOOGLE_CLIENT_SECRET: 'secret' };
    expect(catalogFor(env).find((one) => one.id === 'google-drive')!.ready).toBe(true);
    expect(presetClientFor('https://drivemcp.googleapis.com/mcp/v1', env)).toEqual({
      client: { client_id: 'id', client_secret: 'secret' },
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      google: true,
    });
    expect(() => presetClientFor('https://gmailmcp.googleapis.com/mcp/v1', {})).toThrow(
      /Google client/,
    );
    expect(presetClientFor('https://mcp.notion.com/mcp', {})).toBeNull();
  });
});
