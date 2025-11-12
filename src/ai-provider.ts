import { GoogleGenerativeAI } from '@google/generative-ai';
import { Ollama } from 'ollama';

export class AIProvider {
  private geminiClient?: GoogleGenerativeAI;
  private ollamaClient?: Ollama;
  private provider: 'gemini' | 'ollama';
  private ollamaModel: string;

  constructor(provider: 'gemini' | 'ollama' = 'gemini', apiKey?: string, ollamaModel?: string, ollamaBaseUrl?: string) {
    this.provider = provider;
    this.ollamaModel = ollamaModel || 'hhao/qwen2.5-coder-tools:7b';

    if (provider === 'gemini') {
      if (!apiKey) {
        throw new Error('Gemini API key is required when using Gemini provider');
      }
      this.geminiClient = new GoogleGenerativeAI(apiKey);
    } else {
      this.ollamaClient = new Ollama({ host: ollamaBaseUrl || 'http://localhost:11434' });
    }
  }

  async suggestSelector(
    brokenSelector: string,
    currentDOM: string,
    historicalDOM?: string
  ): Promise<string> {
    const prompt = this.buildPrompt(brokenSelector, currentDOM, historicalDOM);
    
    if (this.provider === 'ollama') {
      return this.suggestWithOllama(prompt);
    } else {
      return this.suggestWithGemini(prompt);
    }
  }

  private async suggestWithOllama(prompt: string): Promise<string> {
    try {
      console.log(`Using Ollama model: ${this.ollamaModel}`);
      console.log(`Prompt length: ${prompt.length} characters`);
      
      // Save prompt for debugging
      const fs = require('fs');
      const path = require('path');
      const dir = path.join(process.cwd(), '.playwright-healer', 'temp');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'last-prompt.txt'), prompt);
      
      const response = await this.ollamaClient!.chat({
        model: this.ollamaModel,
        messages: [{ role: 'user', content: prompt }],
        stream: false
      });
      let suggestion = response.message.content.trim();
      
      // Strip markdown code blocks if present
      suggestion = suggestion.replace(/```(?:css|javascript|typescript)?\n?/g, '');
      suggestion = suggestion.replace(/```\n?/g, '');
      suggestion = suggestion.trim();
      
      console.log(`Ollama suggested: ${suggestion}`);
      return suggestion;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Ollama request failed: ${msg}`);
    }
  }

  private async suggestWithGemini(prompt: string): Promise<string> {
    // Try different models in order of preference
    const models = ['models/gemini-1.5-flash', 'models/gemini-1.5-pro', 'models/gemini-pro'];
    
    for (const modelName of models) {
      try {
        const model = this.geminiClient!.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        return result.response.text()?.trim() || '';
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        
        // If quota issue, don't try other models
        if (msg.includes('quota')) {
          throw new Error(`Gemini API quota exceeded. Wait or upgrade your plan.`);
        }
        
        // If model not found, try next model
        if (msg.includes('not found') || msg.includes('404')) {
          console.log(`Model ${modelName} not available: ${msg}`);
          continue;
        }
        
        // Other errors, throw immediately
        throw new Error(`AI request failed: ${msg}`);
      }
    }
    
    throw new Error('All Gemini models failed. Check your API key or try again later.');
  }

  private buildPrompt(selector: string, currentDOM: string, historicalDOM?: string): string {
    return `Task: Find a CSS selector for an input element on a login page.

The broken selector "${selector}" doesn't work.

Here is the actual HTML DOM from the page:
${this.truncateDOM(currentDOM)}

${historicalDOM ? `Previously this DOM was different:\n${this.truncateDOM(historicalDOM)}\n\n` : ''}
Look at the HTML above and find the input element that should match. Return ONLY the CSS selector that exists in the HTML.

Rules:
- Look for id, data-test, or name attributes
- Return only the selector, nothing else
- Example: #user-name

Selector:`;
  }

  private truncateDOM(dom: string): string {
    const bodyMatch = dom.match(/<body[^>]*>(.*?)<\/body>/s);
    const content = bodyMatch ? bodyMatch[1] : dom;
    return content.length > 8000 ? content.substring(0, 8000) + '...' : content;
  }
}