import { api, expect, fitsTheWidth, test } from './fixtures';
import type { Page } from '@playwright/test';

// Spec 107: a card set on screen — on a chart, its shape and its time in one gesture each, kept on
// the page; in « Modifier », « Régler » a card: its name, its shape, applied then saved. At the
// three widths.

type Saved = { data: { blocks: { block: string; title: unknown; query?: { where?: string } }[] } };

async function monthPage(page: Page) {
  await api(page, '/apps/install', { name: 'finances', dryRun: false });
  const pages = await api<{ id: string; title: string }[]>(page, '/pages?app=Finances');
  return pages.find((one) => one.title === 'Month overview')!.id;
}

const blockNamed = (saved: Saved, fr: string) =>
  saved.data.blocks.find((one) => JSON.stringify(one.title).includes(fr))!;

test('a chart: its shape and its time, one gesture each, kept on the page', async ({
  page,
  account,
}) => {
  void account;
  const id = await monthPage(page);
  await page.goto(`/v3/apps/Finances?t=page:${id}`);
  const name = 'Dépenses mois par mois';
  await page.getByRole('button', { name: `Barres pour « ${name} »` }).click();
  await expect(page.getByRole('button', { name: `Barres pour « ${name} »` })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByLabel(`Période de « ${name} »`).selectOption({ label: '3 mois' });
  await expect
    .poll(async () => blockNamed(await api<Saved>(page, `/entries/${id}`), name).query?.where)
    .toContain('last_days(date, 92)');
  const kept = blockNamed(await api<Saved>(page, `/entries/${id}`), name);
  expect(kept.block).toBe('bar');
  expect(kept.query?.where).toContain("direction = 'out'");
  await fitsTheWidth(page);
});

test('« Régler » a card: its name and its shape, applied, then saved', async ({
  page,
  account,
}) => {
  void account;
  const id = await monthPage(page);
  await page.goto(`/v3/apps/Finances?t=page:${id}`);
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.getByRole('button', { name: 'Régler « Dépenses par fonds »' }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Nom').fill('Par fonds');
  await panel.getByLabel('Forme').selectOption({ label: 'Barres' });
  await panel.getByLabel('Sur').selectOption({ label: '12 mois' });
  await panel.getByRole('button', { name: 'Appliquer' }).click();
  await expect(page.getByRole('heading', { name: 'Par fonds', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Page enregistrée.')).toBeVisible();
  const kept = blockNamed(await api<Saved>(page, `/entries/${id}`), 'Par fonds');
  expect(kept.block).toBe('bar');
  expect(kept.query?.where).toContain('last_days(date, 366)');
  // A card written by the assistant: its name only, said in words.
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.getByRole('button', { name: 'Régler « À payer »' }).click();
  await expect(page.getByRole('dialog').getByText(/écrite par ton assistant/)).toBeVisible();
  await fitsTheWidth(page);
});
