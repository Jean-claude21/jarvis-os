import { createHash, randomBytes } from 'node:crypto';
import { api, expect, test } from './fixtures';

// An assistant connects as Claude does (registration, Jarvis's consent page), then she changes the
// spaces it reaches in Réglages › Assistants.

test('an assistant connects through the consent page; she changes the spaces it reaches', async ({
  page,
  account,
  request,
}) => {
  void account;
  const shared = await api<{ id: string }>(page, '/spaces', { name: 'Maison' });
  const redirect = 'http://localhost:3711/alive';
  // Registered as Claude registers itself: without her session.
  const registered = await request.post('/auth/oauth2/register', {
    data: {
      client_name: 'Claude (e2e)',
      redirect_uris: [redirect],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
  });
  expect(registered.status()).toBe(201);
  const { client_id: clientId } = (await registered.json()) as { client_id: string };
  const verifier = randomBytes(32).toString('base64url');
  const authorize = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirect,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    scope: 'openid profile offline_access',
    state: 'e2e',
    resource: 'http://localhost:3711/mcp',
  });
  await page.goto(`/auth/oauth2/authorize?${authorize.toString()}`);
  await expect(page.getByRole('heading', { name: 'Autoriser Claude (e2e) ?' })).toBeVisible();
  // She lets it reach « Maison » only.
  await page.getByRole('checkbox', { name: /ton espace à toi/ }).uncheck();
  await page.getByRole('button', { name: 'Autoriser' }).click();
  await page.waitForURL(/\/alive\?/);

  await page.goto('/v3/reglages?t=assistants');
  await expect(page.getByText('Claude (e2e)')).toBeVisible();
  await page.getByRole('button', { name: 'Ses espaces' }).click();
  await expect(page.getByRole('checkbox', { name: 'Maison' })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Ama' }).check();
  await page.getByRole('button', { name: 'Garder' }).click();
  await expect
    .poll(async () =>
      (await api<{ id: string }[]>(page, `/clients/${clientId}/spaces`)).map((one) => one.id),
    )
    .toContain(shared.id);
  expect((await api<{ id: string }[]>(page, `/clients/${clientId}/spaces`)).length).toBe(2);
});
