import { api, expect, fitsTheWidth, test } from './fixtures';
import type { Page } from '@playwright/test';

// Spec 107: the cards — a page changed on the page itself, Aujourd'hui's band, a fiche's cards,
// the catalogue's « Ajouter à… ». At the three widths.

async function withFinances(page: Page) {
  await api(page, '/apps/install', { name: 'finances', dryRun: false });
  const pages = await api<{ id: string; title: string }[]>(page, '/pages?app=Finances');
  return pages;
}

const card = (page: Page, title: string) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: title, exact: true }) });

test('an app’s page: add, widen, move and remove cards, then keep it', async ({
  page,
  account,
}) => {
  void account;
  const pages = await withFinances(page);
  const accounts = pages.find((one) => one.title === 'Accounts')!;
  await page.goto(`/v3/apps/Finances?t=page:${accounts.id}`);
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter une carte' }).click();
  const panel = page.getByRole('dialog');
  // What is already on the page says so; a card of another page can be added.
  await expect(panel.getByText('Sur la page').first()).toBeVisible();
  await panel.getByRole('button', { name: 'Ajouter « Dépenses du mois »' }).click();
  await expect(panel.getByText('Sur la page')).toHaveCount(4);
  await panel.getByRole('button', { name: 'Fermer' }).click();
  await expect(card(page, 'Dépenses du mois')).toBeVisible();
  // A figure is moved, never widened: it stands in the band of figures.
  await expect(
    page.getByRole('button', { name: 'Toute la largeur pour « Dépenses du mois »' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Toute la largeur pour « Noter un mouvement »' }).click();
  await page.getByRole('button', { name: 'Monter « Dépenses du mois »' }).click();
  await page.getByRole('button', { name: 'Retirer « Solde par compte »' }).click();
  await fitsTheWidth(page);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Page enregistrée.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Dépenses du mois')).toBeVisible();
  await expect(card(page, 'Solde par compte')).toHaveCount(0);
  const saved = await api<{ data: { blocks: { title: { fr: string }; size?: string }[] } }>(
    page,
    `/entries/${accounts.id}`,
  );
  expect(saved.data.blocks.map((one) => [one.title.fr, one.size ?? null])).toEqual([
    ['Comptes', null],
    ['Dépenses du mois', null],
    ['Noter un mouvement', 'l'],
  ]);
});

test('Aujourd’hui: a band of her own cards, from empty', async ({ page, account }) => {
  void account;
  await withFinances(page);
  await page.goto('/v3/');
  const band = page.getByRole('region', { name: 'Mes cartes' });
  await band.getByRole('button', { name: 'Ajouter une carte' }).click();
  await band.getByRole('button', { name: 'Ajouter une carte' }).click();
  await page.getByRole('dialog').getByLabel('Chercher une carte').fill('à payer');
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter « À payer »' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
  await band.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(band.getByRole('heading', { name: 'À payer', exact: true })).toBeVisible();
  await expect(band.getByRole('button', { name: 'Modifier' })).toBeVisible();
  await fitsTheWidth(page);
});

test('a fiche: its cards from her models, for this entry only', async ({ page, account }) => {
  void account;
  await withFinances(page);
  const saved = await api<{ entries: { id: string; title: string }[] }>(page, '/save', {
    entries: [
      { ref: 'a', kind: 'Account', title: 'Banque', data: { type: 'bank', opening_balance: 1000 } },
      { ref: 'b', kind: 'Account', title: 'Caisse', data: { type: 'cash', opening_balance: 50 } },
      {
        kind: 'Transaction',
        title: 'Loyer',
        data: { amount: 600, date: '2026-11-02', direction: 'out', account: 'a' },
      },
      {
        kind: 'Transaction',
        title: 'Marché',
        data: { amount: 30, date: '2026-11-03', direction: 'out', account: 'b' },
      },
    ],
  });
  const bank = saved.entries.find((one) => one.title === 'Banque')!;
  await page.goto(`/v3/entree/${bank.id}`);
  const cards = page.getByRole('region', { name: 'Ses cartes' });
  await cards.getByRole('button', { name: 'Ajouter une carte' }).click();
  await cards.getByRole('button', { name: 'Ajouter une carte' }).click();
  const panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: 'Ajouter « Mouvements liés »' }).click();
  await panel.getByRole('button', { name: 'Ajouter « Total des mouvements »' }).click();
  await panel.getByRole('button', { name: 'Fermer' }).click();
  await cards.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(cards.getByText('Loyer')).toBeVisible();
  await expect(cards.getByText('Marché')).toHaveCount(0);
  await fitsTheWidth(page);
});

test('the catalogue: a card seen on her data, then put on Aujourd’hui', async ({
  page,
  account,
}) => {
  void account;
  await withFinances(page);
  await page.goto('/v3/construire?t=components');
  const cards = page.getByRole('region', { name: 'Cartes de tes apps' });
  const row = cards.getByRole('listitem').filter({ hasText: 'À payer' });
  await row.getByRole('button', { name: 'Voir' }).click();
  await expect(row.getByRole('heading', { name: 'À payer', exact: true })).toBeVisible();
  await row.getByLabel('Ajouter « À payer » à…').selectOption({ label: 'Aujourd’hui' });
  await expect(page.getByText('« À payer » ajoutée à Aujourd’hui.')).toBeVisible();
  await page.goto('/v3/');
  await expect(
    page.getByRole('region', { name: 'Mes cartes' }).getByRole('heading', { name: 'À payer' }),
  ).toBeVisible();
  await fitsTheWidth(page);
});
