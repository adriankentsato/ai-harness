# AI Harness

Unified TypeScript AI harness supporting OpenAI, Claude, NVIDIA NIM, OpenRouter, and Ollama.

## Features

- **Unified Interface**: Single API for multiple providers
- **Streaming Support**: Real-time streaming responses
- **Auto-routing**: Fallback between providers automatically
- **Type-safe**: Full TypeScript support
- **Lightweight**: Minimal dependencies
- **CLI**: Interactive chat interface

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

## CLI Usage

Interactive chat with streaming responses:

```bash
npm run cli
```

**Commands:**
- `/quit`, `/q` - Exit
- `/models`, `/m` - List available models
- `/provider`, `/p` - Switch provider
- `/clear`, `/c` - Clear conversation
- `/help`, `/h` - Show help

**Example session:**
```
[ollama] > hello
Hello! How can I help you?

[ollama] > /provider openai
Switched to openai

[openai] > /models
23 models available:
  • gpt-4o
  • gpt-4o-mini
  ...
```

### Global Installation

```bash
npm run build
npm link        # Install globally as 'ai-harness'
ai-harness      # Run from anywhere
```

### Remove Global Link

```bash
npm unlink -g ai-harness   # Remove global link
npm unlink                 # Remove local link (in project folder)
```

## Programmatic Usage

```typescript
import { AIHarness } from 'ai-harness';

const harness = new AIHarness();

// Register providers
harness.registerProvider('openai', { apiKey: process.env.OPENAI_API_KEY });
harness.registerProvider('claude', { apiKey: process.env.ANTHROPIC_API_KEY });
harness.registerProvider('ollama', { baseUrl: 'http://localhost:11434' });

// Simple completion
const result = await harness.complete('openai', [
  { role: 'user', content: 'Hello!' }
], {
  model: 'gpt-4o-mini',
  temperature: 0.7
});

console.log(result.text);

// Streaming
for await (const chunk of harness.stream('ollama', messages)) {
  process.stdout.write(chunk.text);
}

// Auto-routing (fallback between providers)
const result = await harness.route(messages, {
  preferred: ['ollama', 'openai', 'claude']
});

// Fetch available models dynamically
const models = await harness.fetchModels('openrouter');
console.log(models.map(m => m.id));
```

## Supported Providers

| Provider | Models | API Key Required |
|----------|--------|-----------------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo, etc. | Yes |
| Claude | claude-3-5-sonnet, claude-3-opus, etc. | Yes |
| NVIDIA NIM | Llama 3.1, Nemotron, Mixtral, etc. | Yes |
| OpenRouter | 100+ models from various providers | Yes |
| Ollama | Local models (Llama, Mistral, etc.) | No |

## Scripts

```bash
npm run cli       # Start interactive CLI
npm run dev       # Run example
npm run build     # Build TypeScript
npm run test      # Run tests
npm run lint      # Run linter
```

## Development

This project follows strict development guidelines documented in `AGENTS.md`. Key principles:

- **Type Safety**: Strict TypeScript with minimal `any` usage
- **Unified Interface**: All providers implement the same core interface
- **Testing**: Comprehensive test coverage with mocked dependencies
- **Code Quality**: Run `npm run lint` before committing

### Development Workflows

Available workflows in `.windsurf/workflows/`:

- **`create-tool.md`**: Guidelines for creating new tools following established patterns
- Follow workflow protocols when extending functionality

### Quality Standards

- Build must pass: `npm run build`
- All tests must pass: `npm test`
- Linter must be clean: `npm run lint`
- Use ES modules with `.js` extensions in imports

## Architecture

```
src/
├── types.ts           # Core interfaces
├── harness.ts         # Main AIHarness class
├── providers/         # Provider implementations
│   ├── openai.ts
│   ├── claude.ts
│   ├── nvidia.ts
│   ├── openrouter.ts
│   └── ollama.ts
├── cli.ts             # Interactive CLI
├── index.ts           # Public exports
└── example.ts         # Usage example
```
