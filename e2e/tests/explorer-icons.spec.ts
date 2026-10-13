import { expect, test } from '@playwright/test';

test.describe('Explorer file icons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e=explorer');
    await expect(page.getByTestId('explorer-harness')).toBeVisible();
  });

  test('tree rows use VS Code Seti file icons', async ({ page }) => {
    const tree = page.locator('.file-tree');
    await expect(tree).toBeVisible();

    const fileRows = tree.locator('.file-tree-item.file');
    await expect(fileRows.first()).toBeVisible();
    const fileCount = await fileRows.count();
    expect(fileCount).toBeGreaterThan(5);

    await expect(tree.locator('.file-type-badge')).toHaveCount(0);

    const setiIcons = tree.locator('.file-tree-item.file .seti-file-icon');
    await expect(setiIcons.first()).toBeVisible();
    expect(await setiIcons.count()).toBeGreaterThanOrEqual(fileCount);

    const pyRow = tree.locator('.file-tree-item.file').filter({ hasText: 'manage.py' }).first();
    await expect(pyRow.locator('.seti-file-icon')).toHaveCSS('font-family', /seti/i);
  });

  test('folders keep folder codicon', async ({ page }) => {
    const folders = page.locator('.file-tree-item.folder .icon.codicon-folder, .file-tree-item.folder .icon.codicon-folder-opened');
    await expect(folders.first()).toBeVisible();
    expect(await folders.count()).toBeGreaterThan(0);
  });

  test('icons align within row height', async ({ page }) => {
    const row = page.locator('.file-tree-item.file').filter({ hasText: 'DEMO.md' }).first();
    await expect(row).toBeVisible();
    const icon = row.locator('.icon').first();
    const rowBox = await row.boundingBox();
    const iconBox = await icon.boundingBox();
    expect(rowBox).not.toBeNull();
    expect(iconBox).not.toBeNull();
    if (rowBox && iconBox) {
      expect(iconBox.height).toBeLessThanOrEqual(18);
      expect(iconBox.width).toBeLessThanOrEqual(20);
      const iconMid = iconBox.y + iconBox.height / 2;
      const rowMid = rowBox.y + rowBox.height / 2;
      expect(Math.abs(iconMid - rowMid)).toBeLessThan(4);
    }
  });

  test('visual snapshot of explorer', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 720 });
    await expect(page.locator('.file-tree')).toHaveScreenshot('explorer-file-tree.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
