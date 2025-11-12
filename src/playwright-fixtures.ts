/**
 * Playwright test fixtures with auto-healing enabled.
 * Import from 'playwright-auto-healer' instead of '@playwright/test'
 * to automatically enable healing when run via CLI.
 */

import { test as base } from '@playwright/test';
import { setupAutoHealing } from './setup';

export const test = base.extend({
  page: async ({ page }, use) => {
    if (process.env.PLAYWRIGHT_HEALER_ACTIVE === 'true') {
      setupAutoHealing(page);
    }
    await use(page);
  },
});

export { expect } from '@playwright/test';
