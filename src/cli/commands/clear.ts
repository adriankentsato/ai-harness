import type { CliContext } from '../types';

export function handleClear(context: CliContext): void {
  context.clearConversation();
  context.rl.prompt();
}
