import type { CliContext } from '../types';

async function interactiveSelect(options: string[], initialIndex: number): Promise<string | null> {
  let index = initialIndex;
  let linesPrinted = 0;
  const windowSize = 10;

  const render = () => {
    if (linesPrinted > 0) {
      process.stdout.write(`\x1b[${linesPrinted}A`);
    }

    const start = Math.max(0, Math.min(index - Math.floor(windowSize / 2), options.length - windowSize));
    const end = Math.min(start + windowSize, options.length);

    if (start > 0) {
      process.stdout.write(`  ... (${start - 1} models above)\n`);
    }

    for (let i = start; i < end; i++) {
      const prefix = i === index ? '▸ ' : '  ';
      process.stdout.write(`\x1b[2K${prefix}${options[i]}\n`);
    }

    if (end < options.length) {
      process.stdout.write(`  ... (${options.length - end} models below)\n`);
    }

    linesPrinted = (end - start) + (start > 0 ? 1 : 0) + (end < options.length ? 1 : 0);
  };

  return new Promise((resolve) => {
    const onData = (data: Buffer) => {
      const char = data.toString();
      if (char === '\u0003') { // Ctrl+C
        cleanup();
        resolve(null);
      } else if (char === '\r' || char === '\n') { // Enter
        cleanup();
        resolve(options[index]);
      } else if (char === '\u001b[A') { // Up arrow
        index = (index - 1 + options.length) % options.length;
        render();
      } else if (char === '\u001b[B') { // Down arrow
        index = (index + 1) % options.length;
        render();
      }
    };

    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);

    render();
  });
}

export async function handleModels(context: CliContext): Promise<void> {
  const { state, harness, rl } = context;
  const { currentProvider } = state;

  if (!currentProvider) {
    console.log('No provider configured. Use /config to add one.\n');
    return;
  }

  try {
    const models = await harness.fetchModels(currentProvider);
    if (models.length === 0) {
      console.log('No models available for this provider.\n');
      return;
    }

    console.log(`\n${models.length} models available. Use arrow keys to select, Enter to confirm, Ctrl+C to cancel:`);
    
    rl.pause();
    const modelIds = models.map(m => m.id);
    const currentIdx = modelIds.indexOf(state.currentModel || '');
    
    const selectedId = await interactiveSelect(modelIds, currentIdx !== -1 ? currentIdx : 0);
    rl.resume();

    if (selectedId) {
      state.currentModel = selectedId;
      context.updatePrompt();
      console.log(`\nSelected model: ${selectedId}\n`);
    } else {
      console.log('\nSelection cancelled.\n');
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}\n`);
  }
}
