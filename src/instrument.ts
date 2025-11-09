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

function getResultsFilePath(): string {
  const tempDir = join(process.cwd(), '.playwright-healer-temp');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  return join(tempDir, 'healing-results.json');
}

function saveHealingResult(result: HealingResult): void {
  const filePath = getResultsFilePath();
  let results: HealingResult[] = [];
  
  if (existsSync(filePath)) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      results = JSON.parse(content);
    } catch (e) {
      results = [];
    }
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

    if (originalClick) {
      locator.click = async function(options?: any) {
        try {
          return await originalClick(options);
        } catch (error) {
          console.log(`Click failed, attempting healing: ${selector}`);
          
          try {
            const result = await healer.healSelector(page, selector);
            
            if (result.success && result.newSelector) {
              console.log(`Healed: ${selector} -> ${result.newSelector}`);
              
              saveHealingResult({
                file: 'detected-in-test',
                line: 0,
                originalSelector: selector,
                newSelector: result.newSelector,
                status: 'healed',
                timestamp: new Date().toISOString()
              });
              
              return page.locator(result.newSelector).click(options);
            } else {
              saveHealingResult({
                file: 'detected-in-test',
                line: 0,
                originalSelector: selector,
                status: 'failed',
                timestamp: new Date().toISOString()
              });
              throw error;
            }
          } catch (healingError) {
            console.log(`Healing failed for ${selector}: ${healingError}`);
            
            saveHealingResult({
              file: 'detected-in-test',
              line: 0,
              originalSelector: selector,
              status: 'failed',
              timestamp: new Date().toISOString()
            });
            
            throw error;
          }
        }
      };
    }

    if (originalFill) {
      locator.fill = async function(value: string, options?: any) {
        try {
          return await originalFill(value, options);
        } catch (error) {
          console.log(`Fill failed, attempting healing: ${selector}`);
          
          try {
            const result = await healer.healSelector(page, selector);
            
            if (result.success && result.newSelector) {
              console.log(`Healed: ${selector} -> ${result.newSelector}`);
              
              saveHealingResult({
                file: 'detected-in-test',
                line: 0,
                originalSelector: selector,
                newSelector: result.newSelector,
                status: 'healed',
                timestamp: new Date().toISOString()
              });
              
              return page.locator(result.newSelector).fill(value, options);
            } else {
              saveHealingResult({
                file: 'detected-in-test',
                line: 0,
                originalSelector: selector,
                status: 'failed',
                timestamp: new Date().toISOString()
              });
              throw error;
            }
          } catch (healingError) {
            console.log(`Healing failed for ${selector}: ${healingError}`);
            
            saveHealingResult({
              file: 'detected-in-test',
              line: 0,
              originalSelector: selector,
              status: 'failed',
              timestamp: new Date().toISOString()
            });
            
            throw error;
          }
        }
      };
    }

    return locator;
  };
}