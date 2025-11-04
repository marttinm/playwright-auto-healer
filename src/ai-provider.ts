import { GoogleGenerativeAI } from '@google/generative-ai';

export class AIProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async suggestSelector(
    brokenSelector: string,
    currentDOM: string,
    historicalDOM?: string
  ): Promise<string> {
    const prompt = this.buildPrompt(brokenSelector, currentDOM, historicalDOM);
    
    try {
      const model = this.client.getGenerativeModel({ model: 'models/gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      return response.text()?.trim() || '';
    } catch (error) {
      // Better error handling for quota issues
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('quota')) {
        throw new Error(`Quota exceeded: You've hit the daily/per-minute limit for Gemini API. Please wait or upgrade your plan. Details: ${errorMessage}`);
      }
      throw new Error(`AI provider failed: ${error}`);
    }
  }

  private buildPrompt(selector: string, currentDOM: string, historicalDOM?: string): string {
    return `
The CSS/XPath selector "${selector}" failed to find an element.

Current page DOM:
${this.truncateDOM(currentDOM)}

${historicalDOM ? `Historical DOM:\n${this.truncateDOM(historicalDOM)}\n` : ''}

Find a new selector for the same element. Respond ONLY with the selector, no explanation.
Prefer simple, stable selectors like data-testid, id, or text content.`.trim();
  }

  private truncateDOM(dom: string): string {
    // Keep DOM manageable for AI - focus on body content
    const bodyMatch = dom.match(/<body[^>]*>(.*?)<\/body>/s);
    const content = bodyMatch ? bodyMatch[1] : dom;
    return content.length > 10000 ? content.substring(0, 10000) + '...' : content;
  }
}