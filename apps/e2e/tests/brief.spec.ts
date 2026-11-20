import { api, expect, test } from './fixtures';

// Her morning brief (Réglages › Compte): the hour it comes, kept; read now; the Assistant du matin
// says the hour.

test('chooses the hour of the brief, reads it now, and the agent says it', async ({
  page,
  account,
}) => {
  void account;
  await page.goto('/v3/reglages');
  const hour = page.getByLabel('Heure du brief');
  await hour.fill('07:30');
  await expect
    .poll(async () => (await api<{ brief?: string }>(page, '/me/prefs')).brief)
    .toBe('07:30');
  await page.reload();
  await expect(page.getByLabel('Heure du brief')).toHaveValue('07:30');

  await page.getByRole('button', { name: 'Le lire maintenant' }).click();
  await expect(page.getByRole('dialog', { name: 'Ta journée' })).toContainText('Ta journée du');
  await page.keyboard.press('Escape');

  await page.goto(`/v3/construire/agents/${encodeURIComponent('Assistant du matin')}`);
  await expect(page.getByText('chaque jour à 07:30').first()).toBeVisible();

  await page.goto('/v3/reglages');
  await page.getByRole('button', { name: 'Plus de brief' }).click();
  await expect(page.getByText('pas de brief pour l’instant')).toBeVisible();
});
