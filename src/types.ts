export interface HealerConfig {
  aiProvider?: 'gemini' | 'ollama' | 'anthropic';
  apiKey?: string;
  ollamaModel?: string;
  ollamaBaseUrl?: string;
  anthropicModel?: string;
  createPR?: boolean;
  projectPath?: string;
  maxRetries?: number;
}

export interface HealingResult {
  success: boolean;
  originalSelector: string;
  newSelector?: string;
  error?: string;
  suggestion?: string; // User-friendly suggestion for updating their code
}