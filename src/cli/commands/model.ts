import type { CliContext } from '../types';

export function handleModel(context: CliContext, args: string[]): void {
  const { state, rl, updatePrompt } = context;

  if (!state.currentProvider) {
    console.log('No provider configured. Use /config to add one.\n');
    rl.prompt();
    return;
  }

  if (args.length === 0) {
    if (state.currentModel) {
      console.log(`\nCurrent model: ${state.currentModel}\n`);
    } else {
      console.log(`\nUsing provider default model\n`);
    }
  } else {
    const newModel = args.join(' ');
    state.currentModel = newModel;
    updatePrompt();
    console.log(`Switched to model: ${state.currentModel}\n`);
  }
}
