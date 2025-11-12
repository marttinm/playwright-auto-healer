export { PlaywrightHealer, withAutoHealing } from './playwright-wrapper';
export { AutoHealer } from './healer';
export { setupAutoHealing, getHealingResults } from './setup';
export type { HealerConfig, HealingResult } from './types';

// Re-export test and expect for CLI usage (only works if @playwright/test is installed)
// This is a runtime export that won't break compilation
let test: any, expect: any;
try {
  const fixtures = require('./playwright-fixtures');
  test = fixtures.test;
  expect = fixtures.expect;
} catch (e) {
  // @playwright/test not installed
}

export { test, expect };