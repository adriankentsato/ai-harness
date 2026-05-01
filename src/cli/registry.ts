import type { CliContext } from './types';

type CommandHandler = (context: CliContext, args: string[]) => void | Promise<void>;

interface CommandEntry {
  handler: CommandHandler;
  isAsync: boolean;
}

const commands = new Map<string, CommandEntry>();

export function registerCommand(names: string[], handler: CommandHandler, isAsync = false): void {
  for (const name of names) {
    commands.set(name, { handler, isAsync });
  }
}

export function getCommand(name: string): CommandEntry | undefined {
  return commands.get(name);
}

export function hasCommand(name: string): boolean {
  return commands.has(name);
}

export function getAllCommands(): string[] {
  return Array.from(commands.keys());
}
