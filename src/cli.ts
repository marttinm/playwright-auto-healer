#!/usr/bin/env node

import { config } from 'dotenv';
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

config({ path: process.cwd() + '/.env' });

interface HealingRecommendation {
  file: string;
  line: number;
  brokenSelector: string;
  suggestedFix: string;
  confidence: 'high' | 'medium' | 'low';
  context: string;
}

interface HealingReport {
  timestamp: string;
  totalTests: number;
  failedSelectors: number;
  recommendations: HealingRecommendation[];
  stats: {
    healed: number;
    failed: number;
    skipped: number;
  };
}

class PlaywrightHealerCLI {
  private recommendations: HealingRecommendation[] = [];
  private outputDir = 'auto-heal-recommendations';

  async run(command: string[]): Promise<void> {
    console.log('Starting Playwright Auto-Healer scan...');
    
    this.ensureOutputDirectory();
    
    const env = {
      ...process.env,
      PLAYWRIGHT_HEALER_ACTIVE: 'true'
    };

    const playwrightProcess = spawn(command[0], command.slice(1), {
      stdio: 'pipe',
      env
    });

    let stderr = '';
    let stdout = '';

    playwrightProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(data);
    });

    playwrightProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      this.parsePlaywrightErrors(output);
      process.stderr.write(data);
    });

    playwrightProcess.on('close', (code) => {
      this.generateRecommendations(stderr, stdout);
      this.generateReport();
      console.log(`\nHealing scan complete. Check ${this.outputDir}/ for recommendations.`);
      process.exit(code || 0);
    });
  }

  private ensureOutputDirectory(): void {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private parsePlaywrightErrors(output: string): void {
    const lines = output.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Parse locator errors
      const locatorMatch = line.match(/locator\(['"`]([^'"`]+)['"`]\)/);
      if (locatorMatch && line.includes('not found')) {
        const brokenSelector = locatorMatch[1];
        
        // Extract file and line info from stack trace
        const fileMatch = lines.slice(i, i + 10).find(l => 
          l.includes('.spec.ts') || l.includes('.spec.js')
        );
        
        if (fileMatch) {
          const fileInfo = this.extractFileInfo(fileMatch);
          if (fileInfo) {
            this.addRecommendation({
              file: fileInfo.file,
              line: fileInfo.line,
              brokenSelector,
              suggestedFix: this.suggestFix(brokenSelector),
              confidence: this.calculateConfidence(brokenSelector),
              context: line.trim()
            });
          }
        }
      }

      // Parse timeout errors that might indicate selector issues
      if (line.includes('Timeout') && line.includes('waiting for')) {
        const selectorMatch = line.match(/waiting for (?:locator\(['"`]([^'"`]+)['"`]\)|selector "([^"]+)")/);
        if (selectorMatch) {
          const brokenSelector = selectorMatch[1] || selectorMatch[2];
          this.addRecommendation({
            file: 'unknown',
            line: 0,
            brokenSelector,
            suggestedFix: this.suggestFix(brokenSelector),
            confidence: 'medium',
            context: 'Timeout waiting for element'
          });
        }
      }
    }
  }

  private extractFileInfo(line: string): { file: string; line: number } | null {
    const match = line.match(/at.*\(([^:]+):(\d+):\d+\)/);
    if (match) {
      return {
        file: match[1].replace(process.cwd() + '/', ''),
        line: parseInt(match[2])
      };
    }
    return null;
  }

  private suggestFix(brokenSelector: string): string {
    // Common patterns for fixing selectors
    const fixes = {
      // Remove common suffixes that might be test artifacts
      '-broken': '',
      '-wrong': '',
      '-invalid': '',
      '-error': '',
      '-test': '',
      '1': '', // Remove trailing numbers
      '2': '',
      '3': '',
      '-broken-2': '',
      '-adaptive': ''
    };

    let suggested = brokenSelector;
    for (const [pattern, replacement] of Object.entries(fixes)) {
      if (suggested.includes(pattern)) {
        suggested = suggested.replace(pattern, replacement);
        break;
      }
    }

    // If no pattern matched, try some common alternatives
    if (suggested === brokenSelector) {
      if (brokenSelector.startsWith('#')) {
        // Try data-testid version
        const id = brokenSelector.slice(1);
        suggested = `[data-testid="${id}"]`;
      }
    }

    return suggested;
  }

  private calculateConfidence(selector: string): 'high' | 'medium' | 'low' {
    const highConfidencePatterns = ['-broken', '-wrong', '-invalid', '-error'];
    const mediumConfidencePatterns = ['-test', '1', '2', '3'];
    
    if (highConfidencePatterns.some(p => selector.includes(p))) {
      return 'high';
    }
    if (mediumConfidencePatterns.some(p => selector.includes(p))) {
      return 'medium';
    }
    return 'low';
  }

  private addRecommendation(rec: HealingRecommendation): void {
    // Avoid duplicates
    const exists = this.recommendations.some(r => 
      r.brokenSelector === rec.brokenSelector && r.file === rec.file
    );
    if (!exists) {
      this.recommendations.push(rec);
    }
  }

  private generateRecommendations(stderr: string, stdout: string): void {
    // Additional analysis could be done here
    console.log(`\nFound ${this.recommendations.length} potential selector issues`);
  }

  private generateReport(): void {
    // Read healing results from temp file
    const tempFilePath = join(process.cwd(), '.playwright-healer-temp', 'healing-results.json');
    let realResults: any[] = [];
    
    if (existsSync(tempFilePath)) {
      try {
        const content = readFileSync(tempFilePath, 'utf-8');
        realResults = JSON.parse(content);
        console.log(`Found ${realResults.length} healing attempts in temp file`);
      } catch (e) {
        console.log('Could not read healing results from temp file');
      }
    }

    // Combine real results with parsed results
    const allRecommendations = [
      ...realResults.map(r => ({
        file: r.file,
        line: r.line,
        brokenSelector: r.originalSelector,
        suggestedFix: r.newSelector || this.suggestFix(r.originalSelector),
        confidence: r.status === 'healed' ? 'high' as const : 'medium' as const,
        context: r.status === 'healed' ? 'Successfully healed by AI' : 'Failed to heal with AI'
      })),
      ...this.recommendations
    ];

    // Remove duplicates
    const uniqueRecommendations = allRecommendations.filter((rec, index, arr) => 
      arr.findIndex(r => r.brokenSelector === rec.brokenSelector) === index
    );

    const report: HealingReport = {
      timestamp: new Date().toISOString(),
      totalTests: this.extractTestCount(),
      failedSelectors: uniqueRecommendations.length,
      recommendations: uniqueRecommendations,
      stats: {
        healed: realResults.filter(r => r.status === 'healed').length,
        failed: uniqueRecommendations.length - realResults.filter(r => r.status === 'healed').length,
        skipped: 0
      }
    };

    // Write JSON report
    const jsonPath = join(this.outputDir, 'selector-recommendations.json');
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Write human-readable report
    const mdPath = join(this.outputDir, 'healing-report.md');
    this.generateMarkdownReport(mdPath, report);

    console.log(`\nReports generated:`);
    console.log(`- ${jsonPath}`);
    console.log(`- ${mdPath}`);
    
    if (report.stats.healed > 0) {
      console.log(`\nSuccessfully healed ${report.stats.healed} selectors!`);
    }

    // Clean up temp file
    if (existsSync(tempFilePath)) {
      try {
        const fs = require('fs');
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  private generateMarkdownReport(path: string, report: HealingReport): void {
    const content = `# Playwright Auto-Healer Report

Generated: ${report.timestamp}

## Summary
- Total failed selectors: ${report.failedSelectors}
- Recommendations generated: ${report.recommendations.length}

## Recommendations

${report.recommendations.map((rec, i) => `
### ${i + 1}. ${rec.file}:${rec.line}

**Broken Selector:** \`${rec.brokenSelector}\`
**Suggested Fix:** \`${rec.suggestedFix}\`
**Confidence:** ${rec.confidence}
**Context:** ${rec.context}

`).join('')}

## How to Apply Fixes

Replace the broken selectors in your test files with the suggested fixes above.
`;

    writeFileSync(path, content);
  }

  private extractTestCount(): number {
    return 0; // Could be enhanced to parse test output
  }
}

function parseArgs(): { command: string[] } {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] !== 'scan') {
    console.error('Usage: playwright-auto-healer scan [playwright-command]');
    console.error('Example: playwright-auto-healer scan npx playwright test');
    process.exit(1);
  }

  let command: string[];
  if (args.length === 1) {
    // Default command
    command = ['npx', 'playwright', 'test'];
  } else {
    // Parse the command string or use remaining args
    if (args[1].includes(' ')) {
      command = args[1].split(' ');
    } else {
      command = args.slice(1);
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('Warning: GEMINI_API_KEY not found. Advanced healing features disabled.');
  }

  return { command };
}

async function main(): Promise<void> {
  const { command } = parseArgs();
  const cli = new PlaywrightHealerCLI();
  await cli.run(command);
}

if (require.main === module) {
  main().catch(console.error);
}