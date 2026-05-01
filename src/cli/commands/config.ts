import type { ProviderType } from '../../types/index';
import type { CliContext } from '../types';

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
      if (providerName === 'ollama') {
        harness.registerProvider('ollama', { baseUrl: apiKey });
        console.log(`✓ Ollama configured at ${apiKey}\n`);
      } else {
        harness.registerProvider(providerName, { apiKey });
        console.log(`✓ ${providerName} configured with provided key\n`);
      }

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
