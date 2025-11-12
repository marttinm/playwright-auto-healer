// Using generic types to avoid Playwright version conflicts
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
      aiProvider: (process.env.AI_PROVIDER as 'gemini' | 'ollama') || 'ollama',
      apiKey: process.env.GEMINI_API_KEY || '',
      ollamaModel: process.env.OLLAMA_MODEL || 'hhao/qwen2.5-coder-tools:7b',
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      createPR: false,
      projectPath: process.cwd(),
      maxRetries: 1,
      ...config
    };

    const provider = this.config.aiProvider || 'ollama';
    console.log(`Using AI Provider: ${provider}`);
    
    if (provider === 'gemini' && !this.config.apiKey) {
      throw new Error('GEMINI_API_KEY is required when using Gemini provider. Set AI_PROVIDER=ollama to use local Ollama instead.');
    }

    this.aiProvider = new AIProvider(
      provider,
      this.config.apiKey,
      this.config.ollamaModel,
      this.config.ollamaBaseUrl
    );
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
        
        console.log(`Healed selector: ${selector} → ${newSelector}`);
        console.log(`Consider updating your test with the new selector: ${newSelector}`);
        
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