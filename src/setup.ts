import { instrumentPage } from './instrument';
import { HealerConfig } from './types';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load .env file if it exists
config();

export function setupAutoHealing(page: any, config?: Partial<HealerConfig>): void {
  const fullConfig: HealerConfig = {
    aiProvider: (process.env.AI_PROVIDER as 'gemini' | 'ollama') || 'ollama',
    apiKey: process.env.GEMINI_API_KEY || '',
    ollamaModel: process.env.OLLAMA_MODEL || 'hhao/qwen2.5-coder-tools:7b',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    maxRetries: 1,
    projectPath: process.cwd(),
    ...config
  };

  const provider = fullConfig.aiProvider || 'ollama';
  
  if (provider === 'gemini' && !fullConfig.apiKey) {
    console.warn('GEMINI_API_KEY not found. Set AI_PROVIDER=ollama to use local Ollama instead.');
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
  const tempFilePath = join(process.cwd(), '.playwright-healer', 'temp', 'healing-results.json');
  
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