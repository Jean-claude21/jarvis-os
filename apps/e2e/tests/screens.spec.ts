import { expect, fitsTheWidth, signUp, test } from './fixtures';

// Every screen of the v3 opens for a new account, says what it is, throws no error and fits the
// screen, at the three widths.

const SCREENS: { path: string; heading: RegExp }[] = [
  // The greeting follows the hour (« Bonjour », « Bonsoir »), with her name.
  { path: '/v3/', heading: /, Ama$/ },
  { path: '/v3/a-valider', heading: /À valider/ },
  { path: '/v3/agenda', heading: /Agenda/ },
  { path: '/v3/taches', heading: /Tâches/ },
  { path: '/v3/documents', heading: /Documents/ },
  { path: '/v3/personnes', heading: /Personnes/ },
  { path: '/v3/argent', heading: /Argent/ },
  { path: '/v3/objectifs', heading: /Objectifs/ },
  { path: '/v3/bilans', heading: /Bilans/ },
  { path: '/v3/apps', heading: /Mes apps/ },
  { path: '/v3/activite', heading: /Activité/ },
  { path: '/v3/construire', heading: /Construire/ },
  { path: '/v3/construire?t=skills', heading: /Construire/ },
  { path: '/v3/reglages', heading: /Réglages/ },
];

for (const screen of SCREENS) {
  test(`opens ${screen.path}`, async ({ page, account }) => {
    void account;
    await page.goto(screen.path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(screen.heading);
    await page.waitForLoadState('networkidle');
    await fitsTheWidth(page);
  });
}

test('a link opened signed out leads there once signed in', async ({ page }) => {
  const account = await signUp(page);
  await page.context().clearCookies();
  await page.goto('/v3/reglages?t=espaces');
  await expect(page).toHaveURL(/\/connexion\?suite=/);
  await page.getByLabel('Adresse e-mail').fill(account.email);
  await page.getByLabel('Mot de passe').fill(account.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/v3\/reglages\?t=espaces$/);
  await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(/Réglages/);
});

test('the sign-in page offers a forgotten password', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
  await expect(page.getByRole('heading', { name: 'Mot de passe oublié' })).toBeVisible();
  await page.getByLabel('Adresse e-mail').fill('nobody@jarvis.test');
  await page.getByRole('button', { name: 'Recevoir le lien' }).click();
  await expect(page.getByRole('status')).toContainText('Si un compte existe');
});
