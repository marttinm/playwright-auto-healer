// Using generic types to avoid Playwright version conflicts
type PlaywrightPage = any;
type PlaywrightLocator = any;
import { AutoHealer } from './healer';
import { HealerConfig } from './types';

export class PlaywrightHealer {
  private page: PlaywrightPage;
  private healer: AutoHealer;
  private healedSelectors: Array<{original: string, healed: string, timestamp: Date}> = [];

  constructor(page: PlaywrightPage, config: HealerConfig) {
    this.page = page;
    this.healer = new AutoHealer(config);
  }

  async click(selector: string): Promise<void> {
    await this.tryAction(selector, async (locator) => {
      await locator.click({ timeout: 5000 });
    });
  }

  async fill(selector: string, text: string): Promise<void> {
    await this.tryAction(selector, async (locator) => {
      await locator.fill(text, { timeout: 5000 });
    });
  }

  async type(selector: string, text: string): Promise<void> {
    await this.tryAction(selector, async (locator) => {
      await locator.type(text, { timeout: 5000 });
    });
  }

  async waitFor(selector: string, timeout = 5000): Promise<void> {
    await this.tryAction(selector, async (locator) => {
      await locator.waitFor({ timeout });
    });
  }

  private async tryAction(
    selector: string,
    action: (locator: PlaywrightLocator) => Promise<void>
  ): Promise<void> {
    try {
      const locator = this.page.locator(selector);
      // Use shorter timeout for initial try to fail fast
      await action(locator);
    } catch (error) {
      console.log(`Selector failed: ${selector}`);
      
      // Try healing
      const result = await this.healer.healSelector(this.page, selector);
      
      if (result.success && result.newSelector) {
        console.log(`Retrying with healed selector...`);
        console.log(`SUGGESTION: Update your code from '${selector}' to '${result.newSelector}'`);
        
        // Track healed selectors for user reference
        this.healedSelectors.push({
          original: selector,
          healed: result.newSelector,
          timestamp: new Date()
        });
        
        const healedLocator = this.page.locator(result.newSelector);
        await action(healedLocator);
      } else {
        console.log(`Healing failed: ${result.error}`);
        throw error;
      }
    }
  }

  /**
   * Get all selectors that were healed during this session
   * Use this to see what selectors you should update in your code
   */
  getHealedSelectors(): Array<{original: string, healed: string, timestamp: Date}> {
    return [...this.healedSelectors];
  }

  /**
   * Print a summary of all healed selectors with update suggestions
   */
  printHealingSummary(): void {
    if (this.healedSelectors.length === 0) {
      console.log('No selectors needed healing!');
      return;
    }

    console.log('\nHEALING SUMMARY');
    console.log('================');
    console.log('The following selectors were automatically healed:');
    console.log('Consider updating your test code with these new selectors:\n');

    this.healedSelectors.forEach((item, index) => {
      console.log(`${index + 1}. Original: '${item.original}'`);
      console.log(`   Healed:   '${item.healed}'`);
      console.log(`   Time:     ${item.timestamp.toISOString()}`);
      console.log('');
    });

    console.log('Tip: Copy the healed selectors above to update your test files');
    console.log('================\n');
  }
}

// Convenience function for easy integration
export function withAutoHealing(page: PlaywrightPage, config: HealerConfig): PlaywrightHealer {
  return new PlaywrightHealer(page, config);
}