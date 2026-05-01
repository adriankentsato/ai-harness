import type { CliContext } from '../types';

export function handleQuit(_context: CliContext): void {
  console.log('Goodbye!');
  process.exit(0);
}
