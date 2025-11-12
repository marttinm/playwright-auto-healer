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
  status: 'healed' | 'failed';
  timestamp: string;
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
    
    // Helper to heal and retry
    const healAndRetry = async (error: any, result: any, actionFn: () => Promise<any>) => {
      if (result.success && result.newSelector) {
        console.log(`Healed: "${selector}" -> "${result.newSelector}"`);
        
        saveHealingResult({
          file: 'auto-detected',
          line: 0,
          originalSelector: selector,
          newSelector: result.newSelector,
          status: 'healed',
          timestamp: new Date().toISOString()
        });
        
        try {
          return await actionFn();
        } catch (healedError) {
          console.log(`Healed selector also failed: "${result.newSelector}"`);
          saveHealingResult({
            file: 'auto-detected',
            line: 0,
            originalSelector: selector,
            newSelector: result.newSelector,
            status: 'failed',
            timestamp: new Date().toISOString()
          });
        }
      } else {
        console.log(`Healing failed: ${result.error || 'No suggestion'}`);
        saveHealingResult({
          file: 'auto-detected',
          line: 0,
          originalSelector: selector,
          newSelector: result.newSelector || undefined,
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