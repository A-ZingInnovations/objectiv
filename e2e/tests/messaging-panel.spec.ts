import { expect, test } from '@playwright/test';

test('messaging panel sections render', async ({ page }) => {
  await page.goto('/?e2e=messages');
  await expect(page.getByTestId('messaging-panel')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Channels' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Direct Messages' })).toBeVisible();
});
