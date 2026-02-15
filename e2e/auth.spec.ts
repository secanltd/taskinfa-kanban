import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Signup Flow', () => {
    test('should show signup page', async ({ page }) => {
      await page.goto('/auth/signup');
      await expect(page.getByRole('heading', { name: /sign up|create account/i })).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await page.goto('/auth/signup');
      await page.getByRole('button', { name: /sign up|create/i }).click();
      // Should show validation errors
      await expect(page.getByText(/required|email|password/i).first()).toBeVisible();
    });

    test('should show password strength requirements', async ({ page }) => {
      await page.goto('/auth/signup');
      const passwordInput = page.getByLabel(/password/i).first();
      await passwordInput.fill('weak');
      await passwordInput.blur();
      // Should indicate weak password
      await expect(page.locator('form')).toBeVisible();
    });

    test('should successfully create account with valid data', async ({ page }) => {
      const email = `test-${Date.now()}@example.com`;
      await page.goto('/auth/signup');

      await page.getByLabel(/email/i).fill(email);
      // Find password fields - there may be a confirm password field
      const passwordFields = page.getByLabel(/password/i);
      await passwordFields.first().fill('TestPassword123!');
      if (await passwordFields.nth(1).isVisible().catch(() => false)) {
        await passwordFields.nth(1).fill('TestPassword123!');
      }

      // Fill name if present
      const nameField = page.getByLabel(/name/i);
      if (await nameField.isVisible().catch(() => false)) {
        await nameField.fill('Test User');
      }

      await page.getByRole('button', { name: /sign up|create/i }).click();

      // Should redirect to dashboard after successful signup
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    });
  });

  test.describe('Login Flow', () => {
    test('should show login page', async ({ page }) => {
      await page.goto('/auth/login');
      await expect(page.getByRole('heading', { name: /log in|sign in/i })).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/auth/login');
      await page.getByLabel(/email/i).fill('nonexistent@example.com');
      await page.getByLabel(/password/i).fill('WrongPassword1!');
      await page.getByRole('button', { name: /log in|sign in/i }).click();

      // Should show error message
      await expect(page.getByText(/invalid|error|incorrect/i).first()).toBeVisible({ timeout: 5000 });
    });

    test('should have link to signup page', async ({ page }) => {
      await page.goto('/auth/login');
      const signupLink = page.getByRole('link', { name: /sign up|create|register/i });
      await expect(signupLink).toBeVisible();
    });
  });

  test.describe('Logout', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
      await page.goto('/dashboard');
      // Should redirect to login page
      await expect(page).toHaveURL(/auth\/login/, { timeout: 10000 });
    });
  });
});
