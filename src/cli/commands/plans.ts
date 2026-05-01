import type { CliContext } from '../types';

export async function handlePlans(context: CliContext): Promise<void> {
  const { state, harness, rl } = context;
  const { currentProvider } = state;

  if (!currentProvider) {
    console.log('No provider configured. Use /config to add one.\n');
    rl.prompt();
    return;
  }

  try {
    const result = await harness.listPlans(currentProvider);
    console.log(result);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}\n`);
  }
  rl.prompt();
}
