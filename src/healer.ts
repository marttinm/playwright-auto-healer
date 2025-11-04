type PlaywrightPage = any;
type PlaywrightLocator = any;

import { HealerConfig, HealingResult } from './types';
import { AIProvider } from './ai-provider';
import { DOMManager } from './dom-manager';

export class AutoHealer {
  private aiProvider: AIProvider;
  private domManager: DOMManager;
  private config: Required<HealerConfig>;

  constructor(config: HealerConfig) {
    this.config = {
      aiProvider: 'gemini',
      apiKey: process.env.GEMINI_API_KEY || '',
      createPR: false,
      projectPath: process.cwd(),
      maxRetries: 1,
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('Gemini API key is required');
    }

    this.aiProvider = new AIProvider(this.config.apiKey);
    this.domManager = new DOMManager(this.config.projectPath);
  }

  async healSelector(page: PlaywrightPage, selector: string): Promise<HealingResult> {
    try {
      console.log(`Auto-healing selector: ${selector}`);

      // Get current and historical DOM
      const currentDOM = await this.domManager.getCurrentDOM(page);
      const historicalDOM = await this.domManager.getHistoricalDOM(selector);

      // Ask AI for suggestion
      const newSelector = await this.aiProvider.suggestSelector(
        selector,
        currentDOM,
        historicalDOM
      );

      if (!newSelector) {
        return {
          success: false,
          originalSelector: selector,
          error: 'AI could not suggest a new selector'
        };
      }

      // Test the new selector
      try {
        const locator = page.locator(newSelector);
        await locator.first().waitFor({ timeout: 2000 });
        
        // Save successful DOM for future reference
        await this.domManager.saveDOM(selector, currentDOM);
        
        console.log(`✅ Healed: ${selector} → ${newSelector}`);
        
        return {
          success: true,
          originalSelector: selector,
          newSelector,
          suggestion: `Replace '${selector}' with '${newSelector}' in your test file`
        };
      } catch {
        return {
          success: false,
          originalSelector: selector,
          newSelector,
          error: 'Suggested selector also failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        originalSelector: selector,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}