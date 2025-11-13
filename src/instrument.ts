type PlaywrightPage = any;
import { AutoHealer } from './healer';
import { HealerConfig } from './types';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface HealingResult {
  file: string;
  line: number;
  originalSelector: string;
  newSelector?: string;
  selectorType?: 'getByRole' | 'getByLabel' | 'getByPlaceholder' | 'getByText' | 'getByTestId' | 'getByTitle' | 'cssSelector' | 'unknown';
  status: 'healed' | 'failed';
  timestamp: string;
}

const globalHealingCache = new Map<string, { newSelector: string; success: boolean }>();

function detectSelectorType(selector: string): HealingResult['selectorType'] {
  if (!selector) return 'unknown';
  
  if (selector.match(/^\[role=["']?|role=/i)) return 'getByRole';
  if (selector.match(/^\[aria-label=["']?|aria-label=/i)) return 'getByRole';
  if (selector.match(/^\[for=["']?|label\[/i)) return 'getByLabel';
  if (selector.match(/^\[placeholder=["']?|placeholder=/i)) return 'getByPlaceholder';
  if (selector.match(/^\[data-testid=["']?|data-testid=/i)) return 'getByTestId';
  if (selector.match(/^\[data-test=["']?|data-test=/i)) return 'getByTestId';
  if (selector.match(/^\[data-cy=["']?|data-cy=/i)) return 'getByTestId';
  if (selector.match(/^\[title=["']?|title=/i)) return 'getByTitle';
  if (selector.match(/^text=|:has-text\(|:text\(/i)) return 'getByText';
  if (selector.match(/^#|^\.|^\[|^[a-z]+/i)) return 'cssSelector';
  
  return 'unknown';
}

function extractSelectorValue(selector: string, selectorType: HealingResult['selectorType']): string {
  if (!selector || selectorType === 'cssSelector' || selectorType === 'unknown') {
    return selector;
  }
  
  const match = selector.match(/\[(?:data-testid|placeholder|title|role|aria-label)=["']?([^"'\]]+)["']?\]/i);
  if (match) {
    return match[1];
  }
  
  const textMatch = selector.match(/^text=["']?([^"']+)["']?$/i);
  if (textMatch) {
    return textMatch[1];
  }
  
  return selector;
}

function saveHealingResult(result: HealingResult): void {
  const dir = join(process.cwd(), '.playwright-healer', 'temp');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  
  const filePath = join(dir, 'healing-results.json');
  let results: HealingResult[] = [];
  
  if (existsSync(filePath)) {
    try {
      results = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch (e) { }
  }
  
  results.push(result);
  writeFileSync(filePath, JSON.stringify(results, null, 2));
}

export function instrumentPage(page: PlaywrightPage, config: HealerConfig): void {
  const healer = new AutoHealer(config);
  const originalLocator = page.locator.bind(page);

  page.locator = function(selector: string, options?: any) {
    const locator = originalLocator(selector, options);
    const originalClick = locator.click?.bind(locator);
    const originalFill = locator.fill?.bind(locator);
    
    const healAndRetry = async (error: any, result: any, actionFn: () => Promise<any>) => {
      if (result.success && result.newSelector) {
        console.log(`Healed: "${selector}" -> "${result.newSelector}"`);
        
        globalHealingCache.set(selector, { newSelector: result.newSelector, success: true });
        
        const selectorType = detectSelectorType(result.newSelector);
        
        saveHealingResult({
          file: 'auto-detected',
          line: 0,
          originalSelector: selector,
          newSelector: result.newSelector,
          selectorType: selectorType,
          status: 'healed',
          timestamp: new Date().toISOString()
        });
        
        try {
          return await actionFn();
        } catch (healedError) {
          console.log(`Healed selector also failed: "${result.newSelector}"`);
          const selectorType = detectSelectorType(result.newSelector);
          
          saveHealingResult({
            file: 'auto-detected',
            line: 0,
            originalSelector: selector,
            newSelector: result.newSelector,
            selectorType: selectorType,
            status: 'failed',
            timestamp: new Date().toISOString()
          });
        }
      } else {
        console.log(`Healing failed: ${result.error || 'No suggestion'}`);
        const selectorType = result.newSelector ? detectSelectorType(result.newSelector) : undefined;
        
        saveHealingResult({
          file: 'auto-detected',
          line: 0,
          originalSelector: selector,
          newSelector: result.newSelector,
          selectorType: selectorType,
          status: 'failed',
          timestamp: new Date().toISOString()
        });
      }
      throw error;
    };

    if (originalClick) {
      locator.click = async function(clickOptions?: any) {
        try {
          return await originalClick({ ...clickOptions, timeout: 5000 });
        } catch (error) {
          const cached = globalHealingCache.get(selector);
          if (cached) {
            console.log(`Using cached healing: ${selector} → ${cached.newSelector}`);
            if (cached.success) {
              return await page.locator(cached.newSelector).click(clickOptions);
            } else {
              throw error;
            }
          }
          
          console.log(`Click failed on "${selector}", attempting AI healing...`);
          const result = await healer.healSelector(page, selector);
          return await healAndRetry(error, result, () => 
            page.locator(result.newSelector!).click(clickOptions)
          );
        }
      };
    }

    if (originalFill) {
      locator.fill = async function(value: string, fillOptions?: any) {
        try {
          return await originalFill(value, { ...fillOptions, timeout: 5000 });
        } catch (error) {
          const cached = globalHealingCache.get(selector);
          if (cached) {
            console.log(`Using cached healing: ${selector} → ${cached.newSelector}`);
            if (cached.success) {
              return await page.locator(cached.newSelector).fill(value, fillOptions);
            } else {
              throw error;
            }
          }
          
          console.log(`Fill failed on "${selector}", attempting AI healing...`);
          const result = await healer.healSelector(page, selector);
          return await healAndRetry(error, result, () => 
            page.locator(result.newSelector!).fill(value, fillOptions)
          );
        }
      };
    }

    return locator;
  };
}