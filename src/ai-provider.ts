import { GoogleGenerativeAI } from '@google/generative-ai';
import { Ollama } from 'ollama';
import Anthropic from '@anthropic-ai/sdk';

export class AIProvider {
  private geminiClient?: GoogleGenerativeAI;
  private ollamaClient?: Ollama;
  private anthropicClient?: Anthropic;
  private provider: 'gemini' | 'ollama' | 'anthropic';
  private ollamaModel: string;
  private anthropicModel: string;

  constructor(provider: 'gemini' | 'ollama' | 'anthropic' = 'gemini', apiKey?: string, ollamaModel?: string, ollamaBaseUrl?: string, anthropicModel?: string) {
    this.provider = provider;
    this.ollamaModel = ollamaModel || 'hhao/qwen2.5-coder-tools:7b';
    this.anthropicModel = anthropicModel || 'claude-3-haiku-20240307';

    if (provider === 'gemini') {
      if (!apiKey) {
        throw new Error('Gemini API key is required when using Gemini provider');
      }
      this.geminiClient = new GoogleGenerativeAI(apiKey);
    } else if (provider === 'anthropic') {
      if (!apiKey) {
        throw new Error('Anthropic API key is required when using Anthropic provider');
      }
      console.log(`Anthropic API Key (first 20 chars): ${apiKey.substring(0, 20)}...`);
      this.anthropicClient = new Anthropic({ apiKey });
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
    } else if (this.provider === 'anthropic') {
      return this.suggestWithAnthropic(prompt);
    } else {
      return this.suggestWithGemini(prompt);
    }
  }

  private async suggestWithOllama(prompt: string): Promise<string> {
    try {
      console.log(`Using Ollama model: ${this.ollamaModel}`);
      console.log(`Prompt length: ${prompt.length} characters`);
      
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
    const models = ['models/gemini-1.5-flash', 'models/gemini-1.5-pro', 'models/gemini-pro'];
    
    for (const modelName of models) {
      try {
        const model = this.geminiClient!.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        return result.response.text()?.trim() || '';
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        
        if (msg.includes('quota')) {
          throw new Error(`Gemini API quota exceeded. Wait or upgrade your plan.`);
        }
        
        if (msg.includes('not found') || msg.includes('404')) {
          console.log(`Model ${modelName} not available: ${msg}`);
          continue;
        }
        
        throw new Error(`AI request failed: ${msg}`);
      }
    }
    
    throw new Error('All Gemini models failed. Check your API key or try again later.');
  }

  private async suggestWithAnthropic(prompt: string): Promise<string> {
    try {
      console.log(`Using Anthropic model: ${this.anthropicModel}`);
      console.log(`Prompt length: ${prompt.length} characters`);
      
      const fs = require('fs');
      const path = require('path');
      const dir = path.join(process.cwd(), '.playwright-healer', 'temp');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'last-prompt.txt'), prompt);
      
      const response = await this.anthropicClient!.messages.create({
        model: this.anthropicModel,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      let suggestion = content.type === 'text' ? content.text.trim() : '';
      
      suggestion = suggestion.replace(/```(?:css|javascript|typescript)?\n?/g, '');
      suggestion = suggestion.replace(/```\n?/g, '');
      suggestion = suggestion.trim();
      
      console.log(`Anthropic suggested: ${suggestion}`);
      return suggestion;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Anthropic request failed: ${msg}`);
    }
  }

  private buildPrompt(selector: string, currentDOM: string, historicalDOM?: string): string {
    return `Find a CSS selector for an element in HTML.

BROKEN SELECTOR: "${selector}"

HTML:
${this.truncateDOM(currentDOM)}

${historicalDOM ? `Previous HTML:\n${this.truncateDOM(historicalDOM)}\n\n` : ''}
INSTRUCTIONS:
1. Find the element that matches the broken selector's intent
2. Use ONLY attributes that exist in the HTML above
3. Return ONLY the selector string - no explanations, no code blocks, no text
4. Prefer: placeholder > data-test > data-testid > id > name

EXAMPLES:
HTML: <input data-test="username">
Response: [data-test="username"]

HTML: <input placeholder="Password">
Response: [placeholder="Password"]

HTML: <button id="login-button">
Response: #login-button

Return only the selector:`;
  }

  private truncateDOM(dom: string): string {
    const bodyMatch = dom.match(/<body[^>]*>(.*?)<\/body>/s);
    const content = bodyMatch ? bodyMatch[1] : dom;
    return content.length > 8000 ? content.substring(0, 8000) + '...' : content;
  }
}