import type { CliContext } from '../types';

export async function handlePlan(context: CliContext, args: string[]): Promise<void> {
  const { state, harness, rl } = context;
  const { currentProvider } = state;

  if (!currentProvider) {
    console.log('No provider configured. Use /config to add one.\n');
    rl.prompt();
    return;
  }

  if (args.length === 0) {
    console.log('Usage: /plan <goal>\n');
    rl.prompt();
    return;
  }

  try {
    const goal = args.join(' ');
    console.log('Creating plan...');
    const result = await harness.createPlan(currentProvider, goal);
    console.log(result);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}\n`);
  }
  rl.prompt();
}
