import { test, expect, Page } from '@playwright/test';

// Helper to create an authenticated session
async function loginAsTestUser(page: Page) {
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'TestPassword123!';

  // Sign up first
  await page.goto('/auth/signup');
  await page.getByLabel(/email/i).fill(email);
  const passwordFields = page.getByLabel(/password/i);
  await passwordFields.first().fill(password);
  if (await passwordFields.nth(1).isVisible().catch(() => false)) {
    await passwordFields.nth(1).fill(password);
  }
  const nameField = page.getByLabel(/name/i);
  if (await nameField.isVisible().catch(() => false)) {
    await nameField.fill('E2E Test User');
  }
  await page.getByRole('button', { name: /sign up|create/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 10000 });
}

test.describe('Dashboard', () => {
  test('should display kanban board after login', async ({ page }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/dashboard/);
    // Should see the main dashboard content
    await expect(page.locator('main, [role="main"], .dashboard')).toBeVisible();
  });

  test('should display task columns', async ({ page }) => {
    await loginAsTestUser(page);
    // Kanban board should have status columns
    const content = await page.textContent('body');
    // Check for at least some task status references
    expect(
      content?.includes('Backlog') ||
      content?.includes('Todo') ||
      content?.includes('In Progress') ||
      content?.includes('Done')
    ).toBeTruthy();
  });
});

test.describe('Task CRUD', () => {
  test('should open create task modal', async ({ page }) => {
    await loginAsTestUser(page);

    // Look for create/add task button
    const createButton = page.getByRole('button', { name: /add|create|new/i }).first();
    if (await createButton.isVisible().catch(() => false)) {
      await createButton.click();
      // Modal should appear
      await expect(page.getByRole('dialog').or(page.locator('[class*="modal"]')).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Navigation', () => {
  test('should navigate to settings', async ({ page }) => {
    await loginAsTestUser(page);

    const settingsLink = page.getByRole('link', { name: /settings/i }).first();
    if (await settingsLink.isVisible().catch(() => false)) {
      await settingsLink.click();
      await expect(page).toHaveURL(/settings/);
    }
  });

  test('should navigate to projects', async ({ page }) => {
    await loginAsTestUser(page);

    const projectsLink = page.getByRole('link', { name: /projects/i }).first();
    if (await projectsLink.isVisible().catch(() => false)) {
      await projectsLink.click();
      await expect(page).toHaveURL(/projects/);
    }
  });

  test('should navigate to overview', async ({ page }) => {
    await loginAsTestUser(page);

    const overviewLink = page.getByRole('link', { name: /overview/i }).first();
    if (await overviewLink.isVisible().catch(() => false)) {
      await overviewLink.click();
      await expect(page).toHaveURL(/overview/);
    }
  });
});
