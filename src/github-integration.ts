import { Octokit } from '@octokit/rest';
import { promises as fs } from 'fs';
import path from 'path';

export interface PRConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
}

export class GitHubIntegration {
  private octokit: Octokit;
  private config: PRConfig;

  constructor(config: PRConfig) {
    this.config = config;
    this.octokit = new Octokit({ auth: config.token });
  }

  async createHealingPR(
    originalSelector: string,
    newSelector: string,
    filePath: string
  ): Promise<string> {
    try {
      const branchName = `auto-heal-${Date.now()}`;
      const commitMessage = `Auto-heal: Update selector ${originalSelector}`;
      
      // Read and update the test file
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const updatedContent = this.replaceSelector(fileContent, originalSelector, newSelector);
      
      // Create branch and commit
      const { data: ref } = await this.octokit.rest.git.getRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${this.config.branch || 'main'}`
      });

      await this.octokit.rest.git.createRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `refs/heads/${branchName}`,
        sha: ref.object.sha
      });

      // Update file
      const { data: file } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: path.relative(process.cwd(), filePath),
        ref: branchName
      });

      if ('sha' in file) {
        await this.octokit.rest.repos.createOrUpdateFileContents({
          owner: this.config.owner,
          repo: this.config.repo,
          path: path.relative(process.cwd(), filePath),
          message: commitMessage,
          content: Buffer.from(updatedContent).toString('base64'),
          sha: file.sha,
          branch: branchName
        });
      }

      // Create PR
      const { data: pr } = await this.octokit.rest.pulls.create({
        owner: this.config.owner,
        repo: this.config.repo,
        title: `Auto-heal selector in ${path.basename(filePath)}`,
        head: branchName,
        base: this.config.branch || 'main',
        body: this.generatePRBody(originalSelector, newSelector, filePath)
      });

      return pr.html_url;
    } catch (error) {
      throw new Error(`Failed to create PR: ${error}`);
    }
  }

  private replaceSelector(content: string, oldSelector: string, newSelector: string): string {
    // Simple string replacement - could be enhanced for better accuracy
    return content.replace(
      new RegExp(`['"\`]${this.escapeRegex(oldSelector)}['"\`]`, 'g'),
      `'${newSelector}'`
    );
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private generatePRBody(oldSelector: string, newSelector: string, filePath: string): string {
    return `
## Auto-Healing Selector Update

This PR was automatically created by the Playwright Auto-Healer.

### Changes
- **File**: \`${path.basename(filePath)}\`
- **Old selector**: \`${oldSelector}\`
- **New selector**: \`${newSelector}\`

### Why this change?
The original selector failed during test execution. The AI suggested this new selector based on DOM analysis.

**Please review this change carefully before merging!**
    `.trim();
  }
}