#!/usr/bin/env node

import { config } from 'dotenv';
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

config({ path: process.cwd() + '/.env' });

interface HealingResult {
  file: string;
  line: number;
  originalSelector: string;
  newSelector?: string;
  status: 'healed' | 'failed';
  timestamp: string;
}

class PlaywrightHealerCLI {
  private outputDir = '.playwright-healer/recommendations';

  async run(command: string[]): Promise<void> {
    console.log('Starting Playwright Auto-Healer...\n');
    
    this.cleanPreviousTempFiles();
    
    this.ensureOutputDirectory();
    
    const playwrightProcess = spawn(command[0], command.slice(1), {
      stdio: 'inherit',
      env: { ...process.env, PLAYWRIGHT_HEALER_ACTIVE: 'true' },
      shell: true
    });

    playwrightProcess.on('close', (code) => {
      setTimeout(() => {
        this.generateReport();
        console.log(`\nReports saved to ${this.outputDir}/`);
        process.exit(code || 0);
      }, 2000);
    });
  }

  private ensureOutputDirectory(): void {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private cleanPreviousTempFiles(): void {
    const tempFile = join(process.cwd(), '.playwright-healer', 'temp', 'healing-results.json');
    if (existsSync(tempFile)) {
      try { 
        require('fs').unlinkSync(tempFile);
        console.log('Cleaned previous temp files');
      } catch (e) { 
        // Ignore errors if file is in use
      }
    }
  }

  private generateReport(): void {
    const results = this.loadHealingResults();
    const healed = results.filter(r => r.status === 'healed');
    const failed = results.filter(r => r.status === 'failed');

    const report = {
      timestamp: new Date().toISOString(),
      stats: {
        total: results.length,
        healed: healed.length,
        failed: failed.length
      },
      results: results
    };

    // Save JSON report
    writeFileSync(
      join(this.outputDir, 'selector-recommendations.json'),
      JSON.stringify(report, null, 2)
    );

    // Save Markdown report
    writeFileSync(
      join(this.outputDir, 'healing-report.md'),
      this.generateMarkdown(healed, failed)
    );

    if (healed.length > 0) {
      console.log(`\nSuccessfully healed ${healed.length} selector(s)!`);
    } else if (results.length > 0) {
      console.log(`\n${results.length} selector(s) failed to heal. Check the report for details.`);
    } else {
      console.log('\nNo broken selectors detected.');
    }
  }

  private loadHealingResults(): HealingResult[] {
    const tempFile = join(process.cwd(), '.playwright-healer', 'temp', 'healing-results.json');
    
    if (existsSync(tempFile)) {
      try {
        return JSON.parse(readFileSync(tempFile, 'utf-8'));
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  private generateMarkdown(healed: HealingResult[], failed: HealingResult[]): string {
    let md = `# Playwright Auto-Healer Report\n\nGenerated: ${new Date().toISOString()}\n\n`;
    md += `## Summary\n\n`;
    md += `- **Total**: ${healed.length + failed.length}\n`;
    md += `- **Healed**: ${healed.length}\n`;
    md += `- **Failed**: ${failed.length}\n\n`;

    if (healed.length > 0) {
      md += `## Successfully Healed\n\n`;
      healed.forEach((r, i) => {
        md += `### ${i + 1}. \`${r.originalSelector}\` → \`${r.newSelector}\`\n\n`;
        md += `\`\`\`typescript\n`;
        md += `// Before\nawait page.locator('${r.originalSelector}').click();\n\n`;
        md += `// After\nawait page.locator('${r.newSelector}').click();\n`;
        md += `\`\`\`\n\n`;
      });
    }

    if (failed.length > 0) {
      md += `## Failed to Heal\n\n`;
      failed.forEach((r, i) => {
        md += `### ${i + 1}. \`${r.originalSelector}\`\n\n`;
        md += `Manual inspection required.\n\n`;
      });
    }

    md += `## Next Steps\n\n`;
    md += `\`\`\`bash\n`;
    md += `# Update your tests with healed selectors, then re-run\n`;
    md += `npx playwright-auto-healer scan "npx playwright test"\n`;
    md += `\`\`\`\n`;

    return md;
  }
}

function parseArgs(): string[] {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] !== 'scan') {
    console.error('Usage: playwright-auto-healer scan [command]');
    console.error('Example: playwright-auto-healer scan "npx playwright test"');
    process.exit(1);
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY not found in environment');
    console.error('Create a .env file with: GEMINI_API_KEY=your_key_here');
    process.exit(1);
  }

  if (args.length === 1) {
    return ['npx', 'playwright', 'test'];
  }

  const commandStr = args.slice(1).join(' ');
  return commandStr.split(' ');
}

async function main(): Promise<void> {
  const command = parseArgs();
  const cli = new PlaywrightHealerCLI();
  await cli.run(command);
}

if (require.main === module) {
  main().catch(console.error);
}
