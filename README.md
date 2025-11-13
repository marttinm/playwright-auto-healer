<div align="center">

# Playwright Auto-Healer

**AI-powered test maintenance for Playwright**

[![npm version](https://img.shields.io/npm/v/playwright-auto-healer.svg)](https://www.npmjs.com/package/playwright-auto-healer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Features](#features) • [Quick Start](#quick-start) • [Usage](#usage) • [Configuration](#configuration) • [Reports](#reports)

</div>

---

## Overview

Playwright Auto-Healer automatically fixes broken selectors in your Playwright tests using AI. When a selector fails, it analyzes the DOM, suggests a fix, validates it, and continues your test execution—all without manual intervention.

**Perfect for:**
- Reducing test maintenance overhead
- Handling dynamic UIs and frequent UI changes
- CI/CD pipelines with auto-healing capabilities
- Teams wanting self-healing test suites

## Features

- **AI-Powered Healing** - Uses Google Gemini, Anthropic Claude, or local Ollama for intelligent selector suggestions
- **Zero Configuration** - Works out of the box with sensible defaults
- **Automatic Retry** - Seamlessly retries with healed selectors
- **Detailed Reports** - JSON and Markdown reports with file locations, grouped by file and sorted by line
- **Multiple APIs** - Choose from CLI, function hooks, or class-based approaches
- **Historical Learning** - Uses past DOM snapshots for better suggestions
- **Production Ready** - Follows industry best practices for temp file management

## Quick Start

### Installation

```bash
npm install playwright-auto-healer
```

### Setup

Create a `.env` file in your project root:

```env
# Option 1: Use local Ollama (free, no API key needed)
AI_PROVIDER=ollama
OLLAMA_MODEL=hhao/qwen2.5-coder-tools:7b
OLLAMA_BASE_URL=http://localhost:11434

# Option 2: Use Google Gemini (requires API key)
AI_PROVIDER=gemini
GEMINI_API_KEY=your_api_key_here

# Option 3: Use Anthropic Claude (requires API key)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_MODEL=claude-3-haiku-20240307
```

### Basic Usage

**1. Update your test imports:**

```typescript
// Before
import { test, expect } from '@playwright/test';

// After
import { test, expect } from 'playwright-auto-healer';
```

**2. Run with CLI:**

```bash
npx playwright-auto-healer scan "npx playwright test"
```

That's it! The library will automatically detect and heal broken selectors.

## Usage

> **Note:** Methods 1, 2, and 4 automatically heal and continue test execution. Method 3 requires manual handling. Method 5 is for result retrieval only.

### Method 1: CLI (Recommended) • Auto-continues

The simplest way to use auto-healing. Just change imports and run the CLI:

```typescript
// tests/login.spec.ts
import { test, expect } from 'playwright-auto-healer';

test('login test', async ({ page }) => {
  await page.goto('https://example.com');
  await page.locator('#username').fill('user');  // Auto-heals if selector breaks
  await page.locator('#password').fill('pass');
  await page.locator('#login-btn').click();
  
  await expect(page).toHaveURL('/dashboard');
});
```

```bash
# Run tests with auto-healing
npx playwright-auto-healer scan "npx playwright test"
```

---

### Method 2: Setup Function (Automatic Instrumentation) • Auto-continues

Instrument page.locator() for automatic healing without CLI:

```typescript
import { test, expect } from '@playwright/test';
import { setupAutoHealing } from 'playwright-auto-healer';

test('login test', async ({ page }) => {
  setupAutoHealing(page);  // Enable auto-healing for this page
  
  await page.goto('https://example.com');
  await page.locator('#broken-selector').fill('user');  // Will auto-heal and continue
  await page.locator('#password').fill('pass');
  await page.locator('#login-btn').click();
  
  // Test continues automatically if selectors are healed!
});
```

**How it works:**
1. Selector fails → Captures DOM
2. AI analyzes and suggests fix
3. Validates new selector
4. **Automatically retries with healed selector**
5. Test continues without interruption

---

### Method 3: AutoHealer Class (Manual Healing) • Manual handling required

Full control over the healing process - you decide what to do with healed selectors:

```typescript
import { test, expect } from '@playwright/test';
import { AutoHealer } from 'playwright-auto-healer';

test('login test', async ({ page }) => {
  const healer = new AutoHealer({
    aiProvider: 'ollama',
    projectPath: process.cwd()
  });
  
  await page.goto('https://example.com');
  
  const brokenSelector = '#username-old';
  try {
    await page.locator(brokenSelector).fill('user', { timeout: 2000 });
  } catch (error) {
    console.log('Selector failed, attempting to heal...');
    const result = await healer.healSelector(page, brokenSelector);
    
    if (result.success && result.newSelector) {
      console.log(`Healed: ${brokenSelector} → ${result.newSelector}`);
      // YOU must manually use the new selector
      await page.locator(result.newSelector).fill('user');
    } else {
      throw new Error(`Could not heal selector: ${result.error}`);
    }
  }
});
```

**How it works:**
1. Selector fails → You catch the error
2. Call `healSelector()` manually
3. Get result with `success` flag and `newSelector`
4. **You must manually use the healed selector to continue**
5. Full control over error handling

---

### Method 4: PlaywrightHealer Wrapper (OOP Style) • Auto-continues

Object-oriented API with built-in healing:

```typescript
import { test, expect } from '@playwright/test';
import { withAutoHealing } from 'playwright-auto-healer';

test('login test', async ({ page }) => {
  const healer = withAutoHealing(page, {
    aiProvider: 'ollama',
    projectPath: process.cwd()
  });
  
  await page.goto('https://example.com');
  
  // Use healer methods instead of page.locator
  await healer.fill('#username', 'user');
  await healer.fill('#password', 'pass');
  await healer.click('#login-btn');
  
  await expect(page).toHaveURL('/dashboard');
  
  // Print summary of healed selectors
  healer.printHealingSummary();
  
  // Or get results programmatically
  const healedSelectors = healer.getHealedSelectors();
  console.log(`Healed ${healedSelectors.length} selectors`);
});
```

**How it works:**
1. Use healer methods (`fill()`, `click()`, etc.) instead of `page.locator()`
2. Selector fails → Automatically heals
3. **Automatically retries with healed selector**
4. Test continues without interruption
5. Track healed selectors with `getHealedSelectors()` or `printHealingSummary()`

---

### Method 5: Get Healing Results • Result retrieval only

Retrieve healing results after test execution (does not perform healing):

```typescript
import { test, expect } from '@playwright/test';
import { setupAutoHealing, getHealingResults } from 'playwright-auto-healer';

test('login test', async ({ page }) => {
  setupAutoHealing(page);
  
  await page.goto('https://example.com');
  await page.locator('#username').fill('user');
  await page.locator('#password').fill('pass');
  await page.locator('#login-btn').click();
});

test.afterAll(() => {
  const results = getHealingResults();
  
  console.log(`Total healings: ${results.length}`);
  console.log(`Successful: ${results.filter(r => r.status === 'healed').length}`);
  console.log(`Failed: ${results.filter(r => r.status === 'failed').length}`);
  
  // Process results for reporting, CI/CD integration, etc.
  results.forEach(result => {
    if (result.status === 'healed') {
      console.log(`✓ ${result.originalSelector} → ${result.newSelector}`);
    }
  });
});
```

**How it works:**
- Call after tests complete to retrieve healing history
- Does NOT perform healing - only retrieves results
- Useful for reporting, analytics, and CI/CD integration

---

## Auto-Healing Flow

This flow applies to **Methods 1, 2, and 4** (automatic healing):

```
┌─────────────────────┐
│  Selector Fails     │  Playwright can't find element
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Capture DOM        │  Save current page structure
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  AI Analysis        │  Analyze DOM + historical data
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Validate Fix       │  Test suggested selector on live page
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Auto-Heal          │  Automatically retry with working selector
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Continue Test      │  Test execution continues seamlessly
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Generate Report    │  Save recommendations for code updates
└─────────────────────┘
```

**Method 3 (Manual)** stops after "Validate Fix" and returns control to you.

**Method 5** only accesses the "Generate Report" step to retrieve results.

## Configuration

### HealerConfig Interface

```typescript
interface HealerConfig {
  aiProvider?: 'gemini' | 'ollama' | 'anthropic';  // AI provider to use
  apiKey?: string;                                  // Gemini/Anthropic API key
  ollamaModel?: string;                             // Ollama model name
  ollamaBaseUrl?: string;                           // Ollama server URL
  anthropicModel?: string;                          // Anthropic model name
  projectPath?: string;                             // Project root path
  maxRetries?: number;                              // Max healing attempts per selector
  createPR?: boolean;                               // Auto-create GitHub PRs (future)
}
```

### Environment Variables

```env
# AI Provider Selection
AI_PROVIDER=ollama                           # or 'gemini' or 'anthropic'

# Ollama Configuration (default provider)
OLLAMA_MODEL=hhao/qwen2.5-coder-tools:7b    # AI model to use
OLLAMA_BASE_URL=http://localhost:11434      # Ollama server URL

# Gemini Configuration (alternative provider)
GEMINI_API_KEY=your_gemini_api_key_here     # Required for Gemini

# Anthropic Configuration (alternative provider)
ANTHROPIC_API_KEY=your_anthropic_api_key    # Required for Anthropic
ANTHROPIC_MODEL=claude-3-haiku-20240307     # Claude model to use
```

### Example Configurations

**Local Ollama (Free, Recommended):**
```typescript
setupAutoHealing(page, {
  aiProvider: 'ollama',
  ollamaModel: 'hhao/qwen2.5-coder-tools:7b',
  ollamaBaseUrl: 'http://localhost:11434'
});
```

**Google Gemini (Cloud-based):**
```typescript
setupAutoHealing(page, {
  aiProvider: 'gemini',
  apiKey: process.env.GEMINI_API_KEY
});
```

**Anthropic Claude (Cloud-based):**
```typescript
setupAutoHealing(page, {
  aiProvider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  anthropicModel: 'claude-3-haiku-20240307'
});
```

## Project Structure

After running tests, the library creates an organized folder structure:

```
.playwright-healer/
├── recommendations/              # AI healing reports (keep these!)
│   ├── healing-report.md        # Human-readable report
│   └── selector-recommendations.json  # Machine-readable data
├── logs/                        # Historical DOM snapshots
│   └── *_dom.html              # Saved for debugging
└── temp/                       # Runtime files (auto-cleaned)
    ├── healing-results.json    # Current session results
    └── last-prompt.txt         # Last AI prompt (debugging)
```

**File Management Best Practices:**
- Add `.playwright-healer/` to your `.gitignore`
- `recommendations/` and `logs/` are kept permanently for review
- `temp/` is automatically cleaned at the **start** of each run (not end)
- Follows the same pattern as Playwright, Jest, and Cypress

## 🔍 How It Works

```
┌─────────────────────┐
│  Selector Fails     │  Playwright can't find element
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Capture DOM        │  Save current page structure
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  AI Analysis        │  Analyze DOM + historical data
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Validate Fix       │  Test suggested selector on live page
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Auto-Heal          │  Continue test with working selector
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Generate Report    │  Save recommendations for code updates
└─────────────────────┘
```

## Reports

### Healing Report (Markdown)

Located at `.playwright-healer/recommendations/healing-report.md`:

```markdown
# Playwright Auto-Healer Report

Generated: 2025-11-13T10:30:00Z

## Summary
- Total: 5
- Healed: 5
- Failed: 0

## Successfully Healed

### login.spec.ts

#### 1. Line 12: `#user-name-old` → `#user-name`

```typescript
// Before
await page.locator('#user-name-old').fill('user');

// After
await page.locator('#user-name').fill('user');
```

#### 2. Line 15: `#password-old` → `#password`

```typescript
// Before
await page.locator('#password-old').fill('pass');

// After
await page.locator('#password').fill('pass');
```

### checkout.spec.ts

#### 3. Line 8: `.btn-submit-old` → `[data-test="submit"]`

```typescript
// Before
await page.locator('.btn-submit-old').click();

// After
await page.locator('[data-test="submit"]').click();
```
```

**Report Features:**
- Grouped by file for easy navigation
- Sorted by line number within each file
- Shows exact file location for each fix
- Provides before/after code examples

### Recommendations JSON

Located at `.playwright-healer/recommendations/selector-recommendations.json`:

```json
{
  "timestamp": "2025-11-13T10:30:00Z",
  "stats": {
    "total": 5,
    "healed": 5,
    "failed": 0
  },
  "results": [
    {
      "file": "login.spec.ts",
      "line": 12,
      "originalSelector": "#user-name-old",
      "newSelector": "#user-name",
      "selectorType": "cssSelector",
      "status": "healed",
      "timestamp": "2025-11-13T10:30:00Z"
    },
    {
      "file": "login.spec.ts",
      "line": 15,
      "originalSelector": "#password-old",
      "newSelector": "#password",
      "selectorType": "cssSelector",
      "status": "healed",
      "timestamp": "2025-11-13T10:30:00Z"
    }
  ]
}
```

## Author

**Martin Marchetto**
- Email: martin.marchetto@gmail.com
- GitHub: [@marttinm](https://github.com/marttinm)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Roadmap

- [x] Support for Anthropic Claude
- [x] File and line number tracking in reports
- [x] Grouped and sorted healing reports
- [ ] Support for OpenAI and Azure OpenAI
- [ ] Visual regression detection
- [ ] GitHub PR auto-creation for healed selectors
- [ ] Team analytics dashboard
- [ ] Selector stability scoring
- [ ] CI/CD integration templates

## License

MIT - see [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built for the Playwright community**

[Report Bug](https://github.com/marttinm/playwright-auto-healer/issues) • [Request Feature](https://github.com/marttinm/playwright-auto-healer/issues)

</div>
