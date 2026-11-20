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
