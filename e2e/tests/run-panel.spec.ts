import { expect, test } from '@playwright/test';

test.describe('Run and Debug panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e=run');
    await expect(page.getByTestId('run-panel-harness')).toBeVisible();
  });

  test('task buttons use sidebar styling, not default browser chrome', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Python: pytest', exact: true });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveCSS('background-color', /rgba?\(0,\s*0,\s*0,\s*0\)|transparent/i);
    await expect(btn).toHaveCSS('border-width', '0px');
  });

  test('long labels truncate in one row', async ({ page }) => {
    const longBtn = page.getByRole('button', { name: /site-packages\/annotated_types/ });
    await expect(longBtn).toHaveCSS('text-overflow', 'ellipsis');
    await expect(longBtn).toHaveCSS('white-space', 'nowrap');
  });
});
