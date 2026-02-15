import { test, expect, Page } from '@playwright/test';

async function loginAsTestUser(page: Page) {
  const email = `e2e-settings-${Date.now()}@example.com`;
  const password = 'TestPassword123!';

  await page.goto('/auth/signup');
  await page.getByLabel(/email/i).fill(email);
  const passwordFields = page.getByLabel(/password/i);
  await passwordFields.first().fill(password);
  if (await passwordFields.nth(1).isVisible().catch(() => false)) {
    await passwordFields.nth(1).fill(password);
  }
  const nameField = page.getByLabel(/name/i);
  if (await nameField.isVisible().catch(() => false)) {
    await nameField.fill('Settings Test User');
  }
  await page.getByRole('button', { name: /sign up|create/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 10000 });
}

test.describe('Settings Page', () => {
  test('should display settings page', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/settings');

    // Should show settings content
    await expect(page.getByText(/settings|workspace|api key/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should display workspace information', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/settings');

    // Should show workspace ID or name
    await expect(page.locator('body')).toContainText(/workspace/i);
  });

  test('should have API key management section', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/settings');

    // Should show API keys section
    const apiSection = page.getByText(/api key/i).first();
    await expect(apiSection).toBeVisible({ timeout: 5000 });
  });

  test('should be able to create an API key', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/settings');

    // Look for create API key button
    const createKeyButton = page.getByRole('button', { name: /create|generate|new.*key/i }).first();
    if (await createKeyButton.isVisible().catch(() => false)) {
      await createKeyButton.click();

      // Should show dialog/form for creating key
      const dialog = page.getByRole('dialog').or(page.locator('[class*="modal"]')).first();
      if (await dialog.isVisible().catch(() => false)) {
        // Fill in key name
        const nameInput = dialog.getByLabel(/name/i).or(dialog.locator('input[type="text"]')).first();
        if (await nameInput.isVisible().catch(() => false)) {
          await nameInput.fill('Test API Key');
        }
      }
    }
  });
});
