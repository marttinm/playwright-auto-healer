# Playwright Auto-Healer

AI-powered auto-healing for Playwright tests. When selectors fail, AI suggests and tests fixes automatically.

## Quick Start

1. Install:
```bash
npm install playwright-auto-healer
```

2. Set up API key in `.env`:
```env
GEMINI_API_KEY=your_key_here
```

3. Update test imports:
```typescript
// Change from:
import { test, expect } from '@playwright/test';

// To:
import { test, expect } from 'playwright-auto-healer';
```

4. Run with CLI:
```bash
npx playwright-auto-healer scan "npx playwright test"
```

The CLI will automatically detect broken selectors, heal them with AI, and generate reports.

## How It Works

1. **Selector Fails** → Playwright can't find element
2. **AI Analysis** → Analyzes DOM and suggests new selector  
3. **Validation** → Tests suggested selector on live page
4. **Auto-Heal** → Continues test with working selector
5. **Report** → Generates recommendations in `.playwright-healer/recommendations/`

## Project Structure

After running tests, the library creates a single organized folder:

```
.playwright-healer/
├── recommendations/        # AI healing reports (keep these!)
│   ├── healing-report.md
│   └── selector-recommendations.json
├── logs/                  # Historical DOM snapshots (for debugging)
│   └── *_dom.html
└── temp/                  # Runtime temporary files
    ├── healing-results.json
    └── last-prompt.txt
```

> 💡 Add `.playwright-healer/` to your `.gitignore` to keep your repo clean.

**File Management:**
- **recommendations/** and **logs/** - Kept permanently for your review
- **temp/** - Automatically cleaned at the **start** of each new run (not at the end)
- This follows the same pattern as Playwright, Jest, and other testing tools
- Temp files remain after a run to help with debugging failures

## Features

- ✨ **AI-powered** - Uses Google Gemini to suggest fixes
- 🔄 **Automatic retry** - Seamlessly retries with healed selectors
- 📊 **Detailed reports** - JSON and Markdown healing reports
- 🎯 **Simple setup** - Just change imports and run CLI
- 🔍 **DOM learning** - Uses historical DOMs for better suggestions

## Usage Options

### Option 1: CLI (Recommended)

```bash
npx playwright-auto-healer scan "npx playwright test"
```

Requires import change in tests:
```typescript
import { test, expect } from 'playwright-auto-healer';
```

### Option 2: Manual Setup

Add to each test:
```typescript
import { setupAutoHealing } from 'playwright-auto-healer';

test('my test', async ({ page }) => {
  setupAutoHealing(page);
  // ... your test code
});
```

### Option 3: API

```typescript
import { AutoHealer } from 'playwright-auto-healer';

const healer = new AutoHealer({ apiKey: process.env.GEMINI_API_KEY });
const result = await healer.healSelector(page, 'broken-selector');

if (result.success) {
  await page.locator(result.newSelector).click();
}
```

## Configuration

```typescript
interface HealerConfig {
  aiProvider?: 'gemini';      // More providers coming soon
  apiKey?: string;             // Gemini API key
  createPR?: boolean;          // Auto-create GitHub PRs (future)
  projectPath?: string;        // Project root path
  maxRetries?: number;         // Max healing attempts
}
```

## Reports

After running, check `.playwright-healer/recommendations/`:
- `healing-report.md` - Human-readable report with before/after
- `selector-recommendations.json` - Machine-readable JSON

## Roadmap

- [ ] OpenAI, Claude, Azure OpenAI support
- [ ] Performance optimizations and caching
- [ ] GitHub PR auto-creation
- [ ] Team analytics dashboard

## License

MIT - see [LICENSE](LICENSE)
