import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * UUID display guard test.
 *
 * Opens major forms and verifies that no dropdown trigger
 * ever shows a raw UUID to the user.
 *
 * Regex matches standard UUID v4 format: xxxxxxxx-xxxx-...
 */
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-/i;

/**
 * Checks all select triggers on the page for UUID text.
 * Returns an array of offending trigger texts.
 */
async function findUUIDsInSelectTriggers(page: Page): Promise<string[]> {
  const triggers = page.locator('[data-slot="select-trigger"]');
  const count = await triggers.count();
  const violations: string[] = [];

  for (let i = 0; i < count; i++) {
    const text = await triggers.nth(i).innerText();
    if (UUID_REGEX.test(text)) {
      violations.push(text.trim());
    }
  }

  return violations;
}

test.describe('No UUID displayed in dropdowns', () => {
  // These tests require a logged-in session.
  // Skip if no auth cookie is available (CI without auth setup).
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard to check if authenticated
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    const url = page.url();
    if (url.includes('/login')) {
      test.skip();
    }
  });

  test('Check-in form has no UUID in selectors', async ({ page }) => {
    await page.goto('/hotel', { waitUntil: 'networkidle' });

    // Open check-in dialog
    const checkInBtn = page.getByRole('button', { name: /check.?in/i });
    if (await checkInBtn.isVisible()) {
      await checkInBtn.click();
      await page.waitForTimeout(1000); // wait for data to load

      const violations = await findUUIDsInSelectTriggers(page);
      expect(violations, `UUIDs found in check-in form: ${violations.join(', ')}`).toEqual([]);
    }
  });

  test('Reservation form has no UUID in selectors', async ({ page }) => {
    await page.goto('/hotel', { waitUntil: 'networkidle' });

    const reserveBtn = page.getByRole('button', { name: /reserva/i });
    if (await reserveBtn.isVisible()) {
      await reserveBtn.click();
      await page.waitForTimeout(1000);

      const violations = await findUUIDsInSelectTriggers(page);
      expect(violations, `UUIDs found in reservation form: ${violations.join(', ')}`).toEqual([]);
    }
  });

  test('New task dialog has no UUID in selectors', async ({ page }) => {
    await page.goto('/tareas', { waitUntil: 'networkidle' });

    const newTaskBtn = page.getByRole('button', { name: /nueva tarea/i });
    if (await newTaskBtn.isVisible()) {
      await newTaskBtn.click();
      await page.waitForTimeout(1000);

      const violations = await findUUIDsInSelectTriggers(page);
      expect(violations, `UUIDs found in task form: ${violations.join(', ')}`).toEqual([]);
    }
  });

  test('Expense form has no UUID in selectors', async ({ page }) => {
    await page.goto('/finanzas/gastos', { waitUntil: 'networkidle' });

    const newBtn = page.getByRole('button', { name: /nuevo|registrar/i });
    if (await newBtn.isVisible()) {
      await newBtn.click();
      await page.waitForTimeout(1000);

      const violations = await findUUIDsInSelectTriggers(page);
      expect(violations, `UUIDs found in expense form: ${violations.join(', ')}`).toEqual([]);
    }
  });

  test('Catalogs page has no UUID in selectors', async ({ page }) => {
    await page.goto('/configuracion/catalogos', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const violations = await findUUIDsInSelectTriggers(page);
    expect(violations, `UUIDs found in catalogs: ${violations.join(', ')}`).toEqual([]);
  });

  test('Roles page has no UUID in selectors', async ({ page }) => {
    await page.goto('/configuracion/roles', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const violations = await findUUIDsInSelectTriggers(page);
    expect(violations, `UUIDs found in roles: ${violations.join(', ')}`).toEqual([]);
  });

  test('Habitaciones page has no UUID in selectors', async ({ page }) => {
    await page.goto('/hotel/habitaciones', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const violations = await findUUIDsInSelectTriggers(page);
    expect(violations, `UUIDs found in habitaciones: ${violations.join(', ')}`).toEqual([]);
  });

  test('Invite user dialog has no UUID in selectors', async ({ page }) => {
    await page.goto('/configuracion/usuarios', { waitUntil: 'networkidle' });

    const inviteBtn = page.getByRole('button', { name: /invitar/i });
    if (await inviteBtn.isVisible()) {
      await inviteBtn.click();
      await page.waitForTimeout(1000);

      const violations = await findUUIDsInSelectTriggers(page);
      expect(violations, `UUIDs found in invite form: ${violations.join(', ')}`).toEqual([]);
    }
  });
});
