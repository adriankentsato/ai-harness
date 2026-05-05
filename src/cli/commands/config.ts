import type { ProviderType } from '../../types/index';
import type { CliContext } from '../types';
import {
  OpenAIProvider,
  ClaudeProvider,
  NvidiaProvider,
  OpenRouterProvider,
  OllamaProvider,
  GoogleProvider,
} from '../../providers/index';

export function handleConfig(context: CliContext, args: string[]): void {
  const { harness, state, rl, updatePrompt, REQUIRED_ENV_VARS } = context;

  console.log('\n┌─ Provider Configuration ──────────────┐');
  console.log('│                                         │');
  for (const [provider, envVar] of Object.entries(REQUIRED_ENV_VARS)) {
    const isRegistered = harness.hasProvider(provider as ProviderType);
    const status = isRegistered ? '✓' : '✗';
    console.log(`│  ${status} ${provider.padEnd(11)} ${envVar.slice(0, 28).padEnd(28)} │`);
  }
  console.log('│                                         │');
  console.log('│  Usage: /config <provider> <apikey>     │');
  console.log('│  Example: /config openai sk-abc123      │');
  console.log('└─────────────────────────────────────────┘\n');

  if (args.length >= 2) {
    const providerName = args[0] as ProviderType;
    const apiKey = args.slice(1).join(' ');

    if (!REQUIRED_ENV_VARS[providerName]) {
      console.log(`Unknown provider: ${providerName}\n`);
      rl.prompt();
      return;
    }

    try {
      let provider;
      
      switch (providerName) {
        case 'openai':
          provider = new OpenAIProvider({ apiKey });
          break;
        case 'claude':
          provider = new ClaudeProvider({ apiKey });
          break;
        case 'nvidia':
          provider = new NvidiaProvider({ apiKey });
          break;
        case 'openrouter':
          provider = new OpenRouterProvider({ apiKey });
          break;
        case 'ollama':
          provider = new OllamaProvider({ baseUrl: apiKey });
          break;
        case 'google':
          provider = new GoogleProvider({ apiKey });
          break;
        default:
          throw new Error(`Unknown provider: ${providerName}`);
      }

      harness.registerProvider(providerName, provider);
      console.log(`✓ ${providerName} configured\n`);

      if (!state.currentProvider) {
        state.currentProvider = providerName;
        updatePrompt();
      }
    } catch (err) {
      console.error(`✗ Failed to configure ${providerName}: ${(err as Error).message}\n`);
    }
  } else if (args.length === 1) {
    console.log(`Usage: /config ${args[0]} <apikey>\n`);
  }
  rl.prompt();
}
