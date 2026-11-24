import { api, expect, fitsTheWidth, test } from './fixtures';

// Spec 107: « Tableaux de bord » — her dashboards across every app, one tab each: her overview in
// one gesture, a new one named then filled, and a card created on the spot.

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
  await expect(page.getByText('Aucun tableau de bord pour l’instant')).toBeVisible();
  await page.getByRole('button', { name: 'Ma vue d’ensemble' }).first().click();
  await expect(page.getByRole('button', { name: 'Vue d’ensemble', exact: true })).toBeVisible();
  await expect(page.getByText('Solde de tous les comptes')).toBeVisible();
  await fitsTheWidth(page);
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
  await expect(page.getByRole('button', { name: 'Mon mois' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'À payer', exact: true })).toBeVisible();
  await expect(page.getByText('Mes comptes', { exact: true }).first()).toBeVisible();
  await fitsTheWidth(page);
  // The card created is now hers, offered everywhere.
  const cards = await api<{ title: unknown }[]>(page, '/cards');
  expect(cards.some((one) => JSON.stringify(one.title).includes('Mes comptes'))).toBe(true);
});
