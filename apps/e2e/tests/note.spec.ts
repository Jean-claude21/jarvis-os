import { api, expect, test } from './fixtures';

// « Chercher ou noter »: a note made from the bar is kept as she said it, and waits in « À valider »
// to be filed; a phrase starts what it names (F6).

test('a note made from the bar waits in « À valider »', async ({ page, account }) => {
  void account;
  await page.goto('/v3/');
  await page
    .getByRole('button', { name: /Chercher ou noter/ })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByPlaceholder(/Noter quelque chose/).fill('Appeler le plombier jeudi');
  await page.getByRole('option', { name: /Noter « Appeler le plombier jeudi »/ }).click();
  // Kept: the bar closes, and the note waits in « À valider ».
  await expect(page.getByPlaceholder(/Noter quelque chose/)).toBeHidden();
  await page.goto('/v3/a-valider');
  await expect(page.getByText('Appeler le plombier jeudi')).toBeVisible();
});

test('a phrase from the bar starts its automation and files the words', async ({
  page,
  account,
}) => {
  void account;
  await api(page, '/save', {
    entries: [
      {
        kind: 'Rule',
        title: 'Courses sur demande',
        data: {
          when: { phrase: '/courses' },
          then: [{ create: { kind: 'Task', title: 'Faire les courses', link: 'from' } }],
        },
      },
    ],
  });
  await page.goto('/v3/');
  await page
    .getByRole('button', { name: /Chercher ou noter/ })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByPlaceholder(/Noter quelque chose/).fill('/courses samedi');
  await page.keyboard.press('Enter');
  await expect(page.getByPlaceholder(/Noter quelque chose/)).toBeHidden();
  const tasks = await api<{ title: string }[]>(page, '/entries?kind=Task&limit=10');
  expect(tasks.map((one) => one.title)).toContain('Faire les courses');
  await page.goto('/v3/a-valider');
  await expect(page.getByText('/courses samedi')).toHaveCount(0);
});
