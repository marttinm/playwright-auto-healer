import { instrumentPage } from './instrument';
import { HealerConfig } from './types';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function setupAutoHealing(page: any, config?: Partial<HealerConfig>): void {
  const fullConfig: HealerConfig = {
    aiProvider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY || '',
    maxRetries: 1,
    projectPath: process.cwd(),
    ...config
  };

  if (!fullConfig.apiKey) {
    console.warn('GEMINI_API_KEY not found. Auto-healing disabled.');
    return;
  }

  instrumentPage(page, fullConfig);
}

export function getHealingResults(): Array<{
  file: string;
  line: number;
  originalSelector: string;
  newSelector?: string;
  status: 'healed' | 'failed';
  timestamp: string;
}> {
  const tempFilePath = join(process.cwd(), '.playwright-healer-temp', 'healing-results.json');
  
  if (existsSync(tempFilePath)) {
    try {
      const content = readFileSync(tempFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      return [];
    }
  }
  
  return [];
}