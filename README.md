# Playwright Auto-Healer

AI-powered auto-healing for Playwright tests. When selectors break, AI suggests fixes automatically.

## Features

- **AI-powered healing**: Uses Google Gemini to suggest new selectors when tests fail
- **Automatic retry**: Seamlessly retries with healed selectors  
- **Healing visibility**: See exactly what selectors were healed and get update suggestions
- **Auto PR creation**: Optionally creates GitHub PRs with fixes
- **DOM history**: Learns from past DOMs for better suggestions
- **Simple integration**: Drop-in replacement for Playwright actions

## Installation

```bash
npm install playwright-auto-healer
```

## Setup

1. Copy the environment variables template:

```bash
cp .env.example .env
```

2. Add your Google Gemini API key to `.env`:

```env
GEMINI_API_KEY=your_api_key_here
```

## Usage

### Basic Healing

```typescript
import { AutoHealer } from 'playwright-auto-healer';

const healer = new AutoHealer({
  apiKey: process.env.GEMINI_API_KEY
});

const result = await healer.healSelector(page, 'broken-selector');
if (result.success) {
  await page.click(result.newSelector);
}
```

### Wrapper Integration

```typescript
import { PlaywrightHealer } from 'playwright-auto-healer';

const healer = new PlaywrightHealer(page, {
  apiKey: process.env.GEMINI_API_KEY
});

// Auto-healing is built in
await healer.click('.might-break-selector');
await healer.fill('#input-field', 'text');
```

### CLI Scan Mode (Coming Soon)

```bash
npx playwright-auto-healer scan "npx playwright test login.spec.ts"
```

## Configuration

```typescript
interface HealerConfig {
  aiProvider?: 'gemini';
  apiKey?: string;
  createPR?: boolean;
  projectPath?: string;
  maxRetries?: number;
}
```

## How It Works

1. **Selector Fails**: When a Playwright selector doesn't find an element
2. **DOM Analysis**: Captures current page DOM structure
3. **AI Suggestion**: Gemini analyzes the DOM and suggests a new selector
4. **Validation**: Tests the suggested selector on the live page
5. **Healing**: If successful, continues test execution with new selector
6. **Reporting**: Logs healing results for test maintenance

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.