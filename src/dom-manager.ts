type PlaywrightPage = any;
import { promises as fs } from 'fs';
import path from 'path';

export class DOMManager {
  private logsDir: string;

  constructor(projectPath: string) {
    this.logsDir = path.join(projectPath, 'healer-logs');
  }

  async ensureLogsDir(): Promise<void> {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  async getCurrentDOM(page: PlaywrightPage): Promise<string> {
    return await page.content();
  }

  async getHistoricalDOM(selector: string): Promise<string | undefined> {
    try {
      const filename = this.getSelectorFilename(selector);
      const filePath = path.join(this.logsDir, filename);
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return undefined;
    }
  }

  async saveDOM(selector: string, dom: string): Promise<void> {
    await this.ensureLogsDir();
    const filename = this.getSelectorFilename(selector);
    const filePath = path.join(this.logsDir, filename);
    await fs.writeFile(filePath, dom);
  }

  private getSelectorFilename(selector: string): string {
    // Create safe filename from selector
    const safe = selector.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    return `${safe}_dom.html`;
  }
}