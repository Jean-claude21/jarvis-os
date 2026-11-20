import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { api, expect, fitsTheWidth, test } from './fixtures';

// The gestures of the v2 brought to the v3 screen (spec 104), second batch.

/** An app « Classeur » with its kind « Document » and two entries. */
async function classeur(page: import('@playwright/test').Page) {
  await api(page, '/save', {
    entries: [
      {
        kind: 'Model',
        title: 'Papier',
        data: {
          app: 'Classeur',
          label: { fr: 'Papier' },
          fields: [
            { name: 'ref', type: 'text' },
            { name: 'montant', type: 'amount' },
          ],
        },
      },
      { kind: 'Papier', title: 'Bail', data: { ref: 'B-1', montant: 500 } },
      { kind: 'Papier', title: 'Facture eau', data: { ref: 'E-7', montant: 30 } },
    ],
  });
}

test('a kind is renamed in place, and an app says its role', async ({ page, account }) => {
  void account;
  await classeur(page);
  await page.goto('/v3/apps/Classeur');
  await expect(page.getByText('Son rôle')).toBeVisible();
  await page.goto('/v3/apps/Classeur?t=data&kind=Papier');
  await page.getByRole('button', { name: 'Renommer' }).click();
  await page.getByLabel('Nouveau nom').fill('Pièce');
  await page.getByRole('button', { name: 'Garder' }).click();
  await expect(page.getByText('Pièce', { exact: true }).first()).toBeVisible();
  await fitsTheWidth(page);
});

test('ticked rows are set aside together', async ({ page, account }) => {
  void account;
  await classeur(page);
  await page.goto('/v3/apps/Classeur?t=data&kind=Papier&v=table');
  await page.getByLabel('Cocher « Bail »').check();
  await page.getByLabel('Cocher « Facture eau »').check();
  await expect(page.getByText('2 cochée(s)')).toBeVisible();
  await page.getByRole('button', { name: 'Mettre de côté' }).click();
  await expect
    .poll(async () => (await api<unknown[]>(page, '/entries?kind=Papier&limit=10')).length)
    .toBe(0);
});

test('a collection is shared as a form by link', async ({ page, account }) => {
  void account;
  await classeur(page);
  await page.goto('/v3/apps/Classeur?t=data&kind=Papier');
  await page.getByRole('button', { name: 'Partager par un lien' }).click();
  await page.getByRole('button', { name: 'Créer le lien' }).click();
  const link = await page.getByLabel('Lien de partage').inputValue();
  expect(link).toMatch(/\/p\//);
  await page.goto(link);
  await expect(page.locator('form')).toBeVisible();
});

test('her habits show on 28 days in Objectifs', async ({ page, account }) => {
  void account;
  await api(page, '/save', {
    entries: [{ kind: 'Habitude', title: 'Marcher', data: { days: '7/7', since: '2026-10-01' } }],
  });
  await page.goto('/v3/objectifs');
  await expect(page.getByText('Tes habitudes · 28 jours')).toBeVisible();
  await expect(page.getByLabel('Marcher sur 28 jours')).toBeVisible();
  await fitsTheWidth(page);
});

test('a server of tools is offered from the catalogue or by its address', async ({
  page,
  account,
}) => {
  void account;
  await page.goto('/v3/reglages?t=connexions');
  await expect(page.getByText('Un serveur d’outils (MCP)')).toBeVisible();
  await page.getByRole('button', { name: 'Un autre, par son adresse' }).click();
  await expect(page.getByLabel('Adresse du serveur')).toBeVisible();
  await fitsTheWidth(page);
});

test('a folder of notes is imported, and imported again without doubles', async ({
  page,
  account,
}) => {
  void account;
  const folder = join(mkdtempSync(join(tmpdir(), 'jarvis-notes-')), 'Notes');
  mkdirSync(folder);
  writeFileSync(join(folder, 'Idées.md'), '# Idées\n\nPeindre le salon. Voir [[Courses]].');
  writeFileSync(join(folder, 'Courses.md'), '# Courses\n\nRiz, huile.');
  await page.goto('/v3/reglages');
  const found = async () =>
    (await api<{ title: string }[]>(page, '/entries?text=Peindre&limit=10')).length;
  await page.getByLabel('Dossier de notes').setInputFiles(folder);
  await expect.poll(found).toBe(1);
  await page.getByLabel('Dossier de notes').setInputFiles(folder);
  await page.waitForTimeout(1500);
  expect(await found()).toBe(1);
});
