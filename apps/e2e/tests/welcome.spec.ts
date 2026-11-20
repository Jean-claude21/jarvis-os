import { api, expect, fitsTheWidth, test } from './fixtures';

// « Pour commencer »: a new account's first steps on Aujourd'hui, ticked when done, closed for good.

test('a new account sees its first steps, ticks them by doing them, and closes them', async ({
  page,
  account,
}) => {
  void account;
  await page.goto('/v3/');
  await expect(page.getByText('Pour commencer')).toBeVisible();
  await expect(page.getByText('Note une première chose')).toBeVisible();
  await fitsTheWidth(page);

  // A first thing noted, through the step's own button.
  await page.getByRole('button', { name: 'Noter', exact: true }).click();
  await page.getByPlaceholder(/Noter quelque chose/).fill('Acheter du pain');
  await page.keyboard.press('Enter');
  await expect(page.getByPlaceholder(/Noter quelque chose/)).toBeHidden();
  await page.reload();
  await expect(page.getByText('Note une première chose')).toHaveCSS(
    'text-decoration-line',
    'line-through',
  );

  // The brief's hour chosen: its step ticks too.
  await api(page, '/me/prefs', { brief: '07:00' });
  await page.reload();
  await expect(page.getByText('Choisis l’heure de ton brief')).toHaveCSS(
    'text-decoration-line',
    'line-through',
  );

  await page.getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.getByText('Pour commencer')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Pour commencer')).toHaveCount(0);
});
