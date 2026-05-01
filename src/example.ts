import { AIHarness } from './harness';
import type { Message } from './types/index';

async function main() {
  const harness = new AIHarness();

  // Register providers based on available API keys
  if (process.env.OPENAI_API_KEY) {
    harness.registerProvider('openai', {
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('✓ OpenAI registered');
  }

  if (process.env.ANTHROPIC_API_KEY) {
    harness.registerProvider('claude', {
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    console.log('✓ Claude registered');
  }

  if (process.env.NVIDIA_API_KEY) {
    harness.registerProvider('nvidia', {
      apiKey: process.env.NVIDIA_API_KEY,
    });
    console.log('✓ NVIDIA NIM registered');
  }

  if (process.env.OPENROUTER_API_KEY) {
    harness.registerProvider('openrouter', {
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    console.log('✓ OpenRouter registered');
  }

  // Ollama doesn't require API key
  harness.registerProvider('ollama', {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  });
  console.log('✓ Ollama registered');

  console.log('\nRegistered providers:', harness.listProviders());

  // Example message
  const messages: Message[] = [
    {
      role: 'system',
      content: 'You are a helpful assistant. Be concise.',
    },
    {
      role: 'user',
      content: 'What is the capital of France?',
    },
  ];

  // Try each provider
  for (const provider of harness.listProviders()) {
    console.log(`\n--- Testing ${provider} ---`);
    try {
      const result = await harness.complete(provider, messages, {
        maxTokens: 100,
      });
      console.log(`Response: ${result.text}`);
      console.log(`Tokens: ${result.usage.totalTokens}`);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
    }
  }

  // Streaming example with Ollama
  console.log('\n--- Streaming with Ollama ---');
  try {
    const stream = harness.stream('ollama', messages, {
      maxTokens: 50,
    });

    process.stdout.write('Response: ');
    for await (const chunk of stream) {
      if (!chunk.isComplete) {
        process.stdout.write(chunk.text);
      }
    }
    console.log('\n(Stream complete)');
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
  }

  // Auto-routing example
  console.log('\n--- Auto-routing ---');
  try {
    const result = await harness.route(messages, {
      preferred: ['ollama', 'openai', 'claude'],
      maxTokens: 50,
    });
    console.log(`Response: ${result.text}`);
    console.log(`Used provider: ${result.model}`);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
  }
}

main().catch(console.error);
