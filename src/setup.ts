import { instrumentPage } from './instrument';
import { HealerConfig } from './types';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

config();

export function setupAutoHealing(page: any, config?: Partial<HealerConfig>): void {
  const provider = (process.env.AI_PROVIDER as 'gemini' | 'ollama' | 'anthropic') || 'ollama';
  
  let apiKey = '';
  if (provider === 'gemini') {
    apiKey = process.env.GEMINI_API_KEY || '';
  } else if (provider === 'anthropic') {
    apiKey = process.env.ANTHROPIC_API_KEY || '';
  }
  
  const fullConfig: HealerConfig = {
    aiProvider: provider,
    apiKey: apiKey,
    ollamaModel: process.env.OLLAMA_MODEL || 'hhao/qwen2.5-coder-tools:7b',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
    maxRetries: 1,
    projectPath: process.cwd(),
    ...config
  };
  
  if (provider === 'gemini' && !fullConfig.apiKey) {
    console.warn('GEMINI_API_KEY not found. Set AI_PROVIDER=ollama to use local Ollama instead.');
    return;
  }

  if (provider === 'anthropic' && !fullConfig.apiKey) {
    console.warn('ANTHROPIC_API_KEY not found. Set AI_PROVIDER=ollama to use local Ollama instead.');
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