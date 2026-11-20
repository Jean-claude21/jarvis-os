import { randomBytes } from 'node:crypto';
import { test as base, expect, type Page } from '@playwright/test';

// What every test of the v3 starts from: an account of its own, signed in in this browser, and the
// page's errors caught — a test fails on an error in the console or a page wider than the screen.

export interface Account {
  name: string;
  email: string;
  password: string;
}

/** Signs an account up through the server's own door; the browser keeps its session cookie. */
export async function signUp(page: Page, name = 'Ama'): Promise<Account> {
  const account = {
    name,
    email: `${name.toLowerCase()}-${randomBytes(4).toString('hex')}@jarvis.test`,
    password: 'correct-horse-battery',
  };
  const response = await page.request.post('/auth/sign-up/email', { data: account });
  expect(response.ok(), await response.text()).toBe(true);
  return account;
}

/** The API as the signed-in account (same cookies as the page). */
export async function api<T = unknown>(
  page: Page,
  path: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
): Promise<T> {
  const response = await page.request.fetch(`/api${path}`, {
    method,
    ...(body === undefined ? {} : { data: body }),
  });
  expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

/** Nothing passes the right edge of the screen. */
export async function fitsTheWidth(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, 'the page is wider than the screen').toBeLessThanOrEqual(client + 1);
}

export const test = base.extend<{ account: Account; errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      // The browser's own line for an answer the page expected (a 404 it handles itself).
      if (/Failed to load resource/.test(text)) return;
      errors.push(text);
    });
    await use(errors);
    expect(errors, 'errors in the page').toEqual([]);
  },
  account: async ({ page, errors }, use) => {
    void errors;
    await use(await signUp(page));
  },
});

export { expect };
