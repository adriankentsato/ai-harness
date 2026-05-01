import type { CliContext } from '../types';

export async function handleModels(context: CliContext): Promise<void> {
  const { state, harness, rl } = context;
  const { currentProvider } = state;

  if (!currentProvider) {
    console.log('No provider configured. Use /config to add one.\n');
    rl.prompt();
    return;
  }

  try {
    const models = await harness.fetchModels(currentProvider);
    console.log(`\n${models.length} models available:`);
    models.slice(0, 20).forEach(m => {
      const marker = m.id === context.state.currentModel ? '▸ ' : '  ';
      const desc = m.description ? ` - ${m.description}` : '';
      console.log(`${marker}• ${m.id}${desc}`);
    });
    if (models.length > 20) {
      console.log(`  ... and ${models.length - 20} more`);
    }
    console.log();
  } catch (err) {
    console.error(`Error: ${(err as Error).message}\n`);
  }
  rl.prompt();
}
