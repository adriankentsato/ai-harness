import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition } from '../types.js';

const execAsync = promisify(exec);

export interface BashToolArgs {
  command: string;
  cwd?: string;
  timeout?: number;
}

async function executeBash(args: Record<string, unknown>): Promise<string> {
  const typedArgs = args as unknown as BashToolArgs;
  const { command, cwd, timeout } = typedArgs;

  if (!command || typeof command !== 'string') {
    throw new Error('command is required and must be a string');
  }

  const cwdPath = cwd || process.cwd();
  const timeoutMs = timeout || 30000;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: cwdPath,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024, // 1MB buffer
    });

    const output = stdout || stderr;
    return output.length > 10000
      ? output.slice(0, 10000) + '\n... (truncated)'
      : output;
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string };
    const output = err.stdout || err.stderr || err.message;
    throw new Error(output.length > 5000
      ? output.slice(0, 5000) + '\n... (truncated)'
      : output);
  }
}

export const bashTool: ToolDefinition = {
  name: 'bash',
  description: 'Execute a bash command on the local system. Use for file operations, running scripts, checking system info, git commands, etc. The working directory defaults to the current process directory. Timeout defaults to 30 seconds.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The bash command to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory for the command (optional)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (optional, default 30000)',
      },
    },
    required: ['command'],
  },
  execute: executeBash,
};
