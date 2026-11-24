import { api, expect, fitsTheWidth, test } from './fixtures';
import type { Page } from '@playwright/test';

// Spec 109: her agents and their tasks — an agent made; a task set freely (some days, a time),
// following a skill, tried before it is kept, run now, stopped; her text drawn as task lines; a
// skill's moment moved to a task. At the three widths.

async function bilanSkill(page: Page, triggers: unknown[] = []) {
  await api(page, '/save', {
    entries: [
      {
        kind: 'Routine',
        title: 'Bilan hebdo',
        data: {
          instructions: 'Court : ce qui a avancé, ce qui a glissé, trois actions.',
          result: { kind: 'Bilan' },
          triggers,
        },
      },
    ],
  });
}

async function newAgent(page: Page, name: string) {
  await page.goto('/v3/construire');
  await page.getByRole('button', { name: 'Nouvel agent' }).click();
  await page.getByLabel('Nom de l’agent').fill(name);
  await page.getByLabel('Son rôle').fill('Mes bilans, chaque semaine et chaque mois');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
}

test('an agent and its task: set freely, tried, kept, run now, stopped', async ({
  page,
  account,
}) => {
  void account;
  await bilanSkill(page);
  await newAgent(page, 'Bilans');
  await page.getByRole('button', { name: 'Nouvelle tâche' }).click();
  const sheet = page.getByRole('dialog');
  // Certain days: Friday is chosen; Monday added, then removed.
  await sheet.getByRole('button', { name: 'lundi' }).click();
  await sheet.getByRole('button', { name: 'lundi' }).click();
  await sheet.getByLabel('Heure').fill('18:00');
  await sheet.getByRole('button', { name: 'Suivre un skill' }).click();
  await sheet.getByLabel('Le skill').selectOption('Bilan hebdo');
  await expect(
    sheet.getByText(/Chaque vendredi à 18 h, Bilans fait « Bilan hebdo » sur la semaine/),
  ).toBeVisible();
  await sheet.getByRole('button', { name: 'Essai à blanc' }).click();
  const tried = sheet.getByRole('region', { name: 'Essai à blanc' });
  await expect(tried).toContainText('rien n’a été écrit');
  await expect(tried).toContainText('Prochaines fois');
  expect(await api<unknown[]>(page, '/entries?kind=Bilan')).toHaveLength(0);
  await sheet.getByRole('button', { name: 'Créer la tâche' }).click();
  await expect(page.getByText('Tâche créée.')).toBeVisible();
  await expect(page.getByText('chaque vendredi à 18 h').first()).toBeVisible();
  await expect(page.getByText('fait « Bilan hebdo »').first()).toBeVisible();
  await expect(page.getByText(/prochaine fois/).first()).toBeVisible();
  await fitsTheWidth(page);
  // Run now: the bilan to write over the week waits.
  await page.getByRole('button', { name: 'Lancer « Bilan hebdo » maintenant' }).click();
  await expect
    .poll(
      async () => (await api<{ data: { status: string } }[]>(page, '/entries?kind=Bilan')).length,
    )
    .toBe(1);
  // Stopped in one gesture.
  await page.getByRole('switch', { name: 'Arrêter « Bilan hebdo »' }).click();
  await expect(page.getByText('arrêtée').first()).toBeVisible();
  // The list says its next work; the thread and settings open.
  await page.getByRole('button', { name: 'Fil' }).click();
  await expect(page.getByRole('heading', { name: 'Son journal' })).toBeVisible();
  await page.getByRole('button', { name: 'Réglages' }).click();
  await expect(page.getByRole('heading', { name: 'Sa liberté' })).toBeVisible();
  await fitsTheWidth(page);
});

test('her text drawn as task lines; her instructions kept', async ({ page, account }) => {
  void account;
  await newAgent(page, 'Veille');
  await page
    .getByLabel('Ses consignes')
    .fill('Chaque lundi et vendredi à 8h, relis mes offres. Sois bref.');
  await page.getByRole('button', { name: 'Garder' }).first().click();
  await expect(page.getByText('Consignes gardées.')).toBeVisible();
  await page.getByRole('button', { name: 'Tirer les tâches' }).click();
  const lines = page.getByRole('list', { name: 'Tâches lues' });
  await expect(lines).toContainText('chaque lundi et vendredi à 8 h');
  await lines.getByRole('button', { name: /Ajouter la tâche/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByLabel('Le rappel')).toHaveValue(/relis mes offres/);
  await sheet.getByRole('button', { name: 'Créer la tâche' }).click();
  await expect(page.getByText('chaque lundi et vendredi à 8 h').first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Ses consignes')).toHaveValue(/Sois bref/);
  await fitsTheWidth(page);
});

test('a skill’s moment moved to a task of an agent', async ({ page, account }) => {
  void account;
  await bilanSkill(page, [{ schedule: '0 18 * * 5' }]);
  await api(page, '/agents', { title: 'Bilans' });
  await page.goto('/v3/construire?t=skills');
  await page.getByLabel('Faire de « Bilan hebdo » une tâche de l’agent…').selectOption('Bilans');
  const sheet = page.getByRole('dialog');
  await expect(
    sheet.getByText(/Chaque vendredi à 18 h, Bilans fait « Bilan hebdo »/),
  ).toBeVisible();
  await sheet.getByRole('button', { name: 'Créer la tâche' }).click();
  await expect(page.getByText('Suivi par')).toBeVisible();
  await expect(page.getByText(/appartient à une tâche/)).toHaveCount(0);
  await fitsTheWidth(page);
});
