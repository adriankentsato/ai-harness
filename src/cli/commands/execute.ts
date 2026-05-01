import type { CliContext } from '../types';

export async function handleExecute(context: CliContext, args: string[]): Promise<void> {
  const { state, harness, rl } = context;
  const { currentProvider } = state;

  if (!currentProvider) {
    console.log('No provider configured. Use /config to add one.\n');
    rl.prompt();
    return;
  }

  try {
    const planId = args[0];
    console.log('Executing plan...');
    const result = await harness.executePlan(currentProvider, planId);
    console.log(result);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}\n`);
  }
  rl.prompt();
}
