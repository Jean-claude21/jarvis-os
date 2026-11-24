import { api, expect, fitsTheWidth, test } from './fixtures';

// What the v3 vision still asked of the screen (spec 104): a kind's fields edited without an
// assistant.

test('a kind’s fields are renamed and added on screen; her values stay', async ({
  page,
  account,
}) => {
  void account;
  await api(page, '/save', {
    entries: [
      {
        kind: 'Model',
        title: 'Papier',
        data: {
          app: 'Classeur',
          label: { fr: 'Papier' },
          fields: [{ name: 'ref', type: 'text', label: { fr: 'Ref' } }],
        },
      },
      { kind: 'Papier', title: 'Bail', data: { ref: 'B-1' } },
    ],
  });
  await page.goto('/v3/apps/Classeur?t=data&kind=Papier');
  await page.getByRole('button', { name: 'Ses champs' }).click();
  const dialog = page.getByRole('dialog', { name: /Les champs de/ });
  await dialog.getByLabel('Nom du champ').first().fill('Référence');
  await dialog.getByText('Ajouter un champ').click();
  await dialog.getByLabel('Nom du champ').nth(1).fill('Montant payé');
  await dialog.getByRole('button', { name: 'Garder' }).click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(async () => {
      const kinds = await api<
        { kind: string; model?: { fields?: { name: string; label?: { fr?: string } }[] } }[]
      >(page, '/kinds');
      return kinds
        .find((one) => one.kind === 'Papier')
        ?.model?.fields?.map((field) => `${field.name}:${field.label?.fr}`);
    })
    .toEqual(['ref:Référence', 'montant_paye:Montant payé']);
  const [bail] = await api<{ data: { ref: string } }[]>(page, '/entries?kind=Papier');
  expect(bail?.data.ref).toBe('B-1');
  await fitsTheWidth(page);
});

test('« Suivre quelque chose » makes a collection from a phrase, in a new app', async ({
  page,
  account,
}) => {
  void account;
  await page.goto('/v3/apps');
  await page
    .getByRole('button', { name: 'Suivre quelque chose' })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByPlaceholder(/mes actions de grâce/).fill('mes lectures');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByLabel('Nom du champ').first()).toBeVisible();
  await page.getByLabel('Nom de la nouvelle app').fill('Livres');
  await page.getByRole('button', { name: 'Créer la collection' }).click();
  await page.waitForURL(/\/v3\/apps\/Livres/);
  await expect(page.getByText('Lecture').first()).toBeVisible();
});

test('a document is written on screen, in Markdown, and reads as a page', async ({
  page,
  account,
}) => {
  void account;
  await page.goto('/v3/documents');
  await page.getByRole('button', { name: 'Nouveau document' }).click();
  await page.waitForURL(/\/v3\/entree\/.+ecrire=1/);
  const area = page.getByLabel('Le texte');
  await area.fill('Courses de la semaine\n\n');
  await page.getByRole('button', { name: 'Case à cocher' }).click();
  await area.press('End');
  await page.getByRole('button', { name: 'Garder' }).click();
  await expect(page.getByRole('button', { name: 'Modifier' })).toBeVisible();
  await expect(page.getByText('Courses de la semaine')).toBeVisible();
  // The box reads as a box to tick (☐), with its words.
  await expect(page.getByText('à faire')).toBeVisible();
  await fitsTheWidth(page);
});

test('a long list draws only what is on screen', async ({ page, account }) => {
  // Its 300 entries are saved first, 50 at a time, against a database that may be far away.
  test.setTimeout(180_000);
  void account;
  await api(page, '/save', {
    entries: [
      {
        kind: 'Model',
        title: 'Ligne',
        data: { app: 'Registre', label: { fr: 'Ligne' }, fields: [{ name: 'n', type: 'number' }] },
      },
    ],
  });
  // A save takes 50 entries at most.
  for (let batch = 0; batch < 6; batch += 1)
    await api(page, '/save', {
      entries: Array.from({ length: 50 }, (_, at) => ({
        kind: 'Ligne',
        title: `Ligne ${batch * 50 + at + 1}`,
        data: { n: batch * 50 + at + 1 },
      })),
    });
  await page.goto('/v3/apps/Registre?t=data&kind=Ligne&v=list');
  const list = page.locator('[data-long-list="300"]');
  await expect(list).toBeVisible();
  const drawn = await list.locator('[data-index]').count();
  expect(drawn).toBeGreaterThan(5);
  expect(drawn).toBeLessThan(80);
  await fitsTheWidth(page);
});
