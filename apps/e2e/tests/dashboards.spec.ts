import { api, expect, fitsTheWidth, test } from './fixtures';

// Spec 107: « Tableaux de bord » — hers listed, opened in one gesture, deleted with the Activity to
// give it back; her apps' own reached by a line, never listed twice; her overview in one gesture; a
// new one named then filled, and a card created on the spot.

test('the menu leads to her dashboards; her overview is made in one gesture', async ({
  page,
  account,
}) => {
  void account;
  await api(page, '/apps/install', { name: 'finances', dryRun: false });
  await page.goto('/v3/');
  // On the phone the menu folds away: opened first.
  if ((page.viewportSize()?.width ?? 1280) < 768)
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page
    .getByRole('link', { name: 'Tableaux de bord' })
    .locator('visible=true')
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tableaux de bord');
  // None of her own yet; her apps' dashboards are not listed twice, a line leads to them.
  await expect(page.getByText('Aucun tableau de bord pour l’instant')).toBeVisible();
  // Folded by default, opened in one gesture, remembered on this device.
  const fold = page.getByRole('button', { name: /Dans tes apps/ });
  await expect(fold).toHaveAttribute('aria-expanded', 'false');
  await fold.click();
  const inApp = page.getByRole('button', { name: 'Finances › Vue du mois' });
  await expect(inApp).toBeVisible();
  await page.reload();
  await expect(inApp).toBeVisible();
  await expect(page.getByRole('button', { name: /Supprimer « Vue du mois »/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ma vue d’ensemble' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vue d’ensemble');
  await expect(page.getByText('Solde de tous les comptes')).toBeVisible();
  await fitsTheWidth(page);
  // Back to all of hers.
  await page.getByRole('button', { name: 'Tous les tableaux' }).click();
  const mine = page.getByRole('region', { name: 'Mes tableaux de bord' });
  await expect(mine.getByText('Vue d’ensemble', { exact: true })).toBeVisible();
  await fitsTheWidth(page);
  // An app's dashboard opens in the app.
  await inApp.click();
  await expect(page).toHaveURL(/\/v3\/apps\/Finances\?t=page/);
  await page.goBack();
  // Deleted, after a confirmation; the list says so.
  await mine.getByRole('button', { name: 'Supprimer « Vue d’ensemble »' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByText('« Vue d’ensemble » est supprimé.', { exact: false })).toBeVisible();
  await expect(page.getByText('Aucun tableau de bord pour l’instant')).toBeVisible();
});

test('a new dashboard: named, given a card of an app and one created on the spot', async ({
  page,
  account,
}) => {
  void account;
  await api(page, '/apps/install', { name: 'finances', dryRun: false });
  await page.goto('/v3/tableaux');
  await page.getByRole('button', { name: 'Nouveau tableau de bord' }).first().click();
  await page.getByLabel('Nom du tableau de bord').fill('Mon mois');
  await page.getByRole('button', { name: 'Continuer' }).click();
  // Without a card it is not kept: said, not lost without a word.
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText(/Ajoute au moins une carte/)).toBeVisible();
  await page.getByRole('button', { name: 'Ajouter une carte' }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Chercher une carte').fill('à payer');
  await panel.getByRole('button', { name: 'Ajouter « À payer »' }).click();
  // « Créer une carte »: a key figure, named, from plain answers.
  await panel.getByRole('button', { name: 'Créer une carte' }).click();
  await panel.getByRole('button', { name: /Chiffre clé/ }).click();
  await panel.getByLabel('Titre du bloc (facultatif)').fill('Mes comptes');
  await panel.getByRole('button', { name: 'Ajouter à la page' }).click();
  await expect(page.getByText('« Mes comptes » ajoutée.')).toBeVisible();
  await panel.getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mon mois');
  await expect(page.getByRole('heading', { name: 'À payer', exact: true })).toBeVisible();
  await expect(page.getByText('Mes comptes', { exact: true }).first()).toBeVisible();
  await fitsTheWidth(page);
  // The card created is now hers, offered everywhere.
  const cards = await api<{ title: unknown }[]>(page, '/cards');
  expect(cards.some((one) => JSON.stringify(one.title).includes('Mes comptes'))).toBe(true);
});
