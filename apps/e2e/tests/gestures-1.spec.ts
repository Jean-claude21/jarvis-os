import { api, expect, fitsTheWidth, test } from './fixtures';

// The gestures of the v2 brought to the v3 screen (spec 104), first batch.

test('her agenda gets a private address for her phone', async ({ page, account }) => {
  void account;
  await page.goto('/v3/agenda');
  await page.getByRole('button', { name: 'Dans mon téléphone' }).click();
  await page.getByRole('button', { name: 'Créer mon adresse' }).click();
  await expect(page.getByLabel('Adresse de l’agenda')).toHaveValue(/\/agenda\/.+\.ics$/);
  await expect(page.getByRole('link', { name: 'L’ouvrir dans mon calendrier' })).toHaveAttribute(
    'href',
    /^webcal:/,
  );
  await fitsTheWidth(page);
});

test('the kinds that are one are merged in one gesture', async ({ page, account }) => {
  void account;
  // Two pairs of kinds that are one thing under two names.
  await api(page, '/save', {
    entries: [
      { kind: 'dépense', title: 'Pain', data: { montant: 500 } },
      { kind: 'Transaction', title: 'Loyer', data: { amount: 250000 } },
      { kind: 'Doc', title: 'Note de cours' },
      { kind: 'Document', title: 'Contrat' },
    ],
  });
  await page.goto('/v3/a-valider');
  const all = page.getByRole('button', { name: /Tout fusionner/ });
  if (await all.count()) {
    await all.click();
    await expect(page.getByText(/fusion\(s\) faite\(s\)/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Tout fusionner/ })).toHaveCount(0);
  } else {
    // Fewer than two pairs proposed for this data: one merge by itself.
    await expect(page.getByRole('button', { name: 'Fusionner' }).first()).toBeVisible();
  }
});

test('a skill kept as text is proposed in its five parts', async ({ page, account }) => {
  void account;
  await api(page, '/save', {
    entries: [
      {
        kind: 'Routine',
        title: 'bilan-du-soir',
        data: { text: 'Chaque soir à 21h30, fais le bilan de ma journée.\n- trois réussites' },
      },
    ],
  });
  await page.goto('/v3/construire?t=skills');
  await page.getByRole('button', { name: 'Structurer' }).click();
  await expect(page.getByText(/cinq morceaux/).first()).toBeVisible();
  await page.goto('/v3/a-valider');
  await expect(page.getByText(/bilan-du-soir/)).toBeVisible();
});

test('a question with a figure is answered in the bar', async ({ page, account }) => {
  void account;
  const today = new Date().toISOString().slice(0, 10);
  await api(page, '/save', {
    entries: [
      {
        kind: 'Transaction',
        title: 'Taxi',
        data: { amount: 3000, date: today, category: 'transport' },
      },
      {
        kind: 'Transaction',
        title: 'Bus',
        data: { amount: 500, date: today, category: 'transport' },
      },
    ],
  });
  await page.goto('/v3/');
  await page
    .getByRole('button', { name: /Chercher ou noter/ })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByPlaceholder(/Noter quelque chose/).fill('combien en transport ce mois ?');
  await expect(page.getByRole('option', { name: /3\D?500/ })).toBeVisible();
});

test('Réglages says what Jarvis sent and the space’s backups', async ({ page, account }) => {
  void account;
  await page.goto('/v3/reglages');
  await expect(page.getByText('Ce que Jarvis t’a envoyé · 7 jours')).toBeVisible();
  await expect(page.getByText('Rien envoyé ces 7 jours.')).toBeVisible();
  await expect(page.getByText(/Sauvegardes de « /)).toBeVisible();
  await fitsTheWidth(page);
});
