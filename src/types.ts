export interface HealerConfig {
  aiProvider?: 'gemini';
  apiKey?: string;
  createPR?: boolean;
  projectPath?: string;
  maxRetries?: number;
}

export interface HealingResult {
  success: boolean;
  originalSelector: string;
  newSelector?: string;
  error?: string;
  suggestion?: string;
}