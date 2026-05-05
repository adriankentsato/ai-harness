import type { ProviderType } from '../../types/index';
import type { CliContext } from '../types';

export function handleProvider(context: CliContext, args: string[]): void {
  const { state, harness, providers } = context;

  if (args.length === 0) {
    console.log(`\nCurrent: ${state.currentProvider || 'none'}`);
    console.log(`Available: ${providers.join(', ') || 'none'}\n`);
  } else {
    const newProvider = args[0] as ProviderType;
    if (harness.hasProvider(newProvider)) {
      state.currentProvider = newProvider;
      context.updatePrompt();
      console.log(`Switched to ${state.currentProvider}\n`);
    } else {
      console.log(`Unknown provider: ${newProvider}\n`);
    }
  }
}
