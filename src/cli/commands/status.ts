import type { CliContext } from '../types';

export async function handleStatus(context: CliContext, args: string[]): Promise<void> {
  const { state, harness, rl } = context;
  const { currentProvider } = state;

  if (!currentProvider) {
    console.log('No provider configured. Use /config to add one.\n');
    rl.prompt();
    return;
  }

  try {
    const planId = args[0];
    const result = await harness.getPlanStatus(currentProvider, planId);
    console.log(result);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}\n`);
  }
  rl.prompt();
}
