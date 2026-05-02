import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition } from '../types/index';
import { validateCommandSecure, SecurityError } from '../utils/security';
import { z } from 'zod';

const execAsync = promisify(exec);

const INPUT_ARGS = z.object({
  command: z.string().describe('The bash command to execute'),
  cwd: z.string().optional().describe('Working directory for the command (optional)'),
  timeout: z.number().optional().describe('Timeout in milliseconds (optional, default 30000)'),
});

async function executeBash(args: z.infer<typeof INPUT_ARGS>): Promise<string> {
  const { command, cwd, timeout } = args;

  if (!command || typeof command !== 'string') {
    throw new Error('command is required and must be a string');
  }

  // Security validation
  try {
    validateCommandSecure(command);
  } catch (error) {
    if (error instanceof SecurityError) {
      throw error;
    }
    throw new Error(`Security validation failed: ${error}`);
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

export const bashTool: ToolDefinition<z.infer<typeof INPUT_ARGS>, string> = {
  name: 'bash',
  description: 'Execute a bash command on the local system. Use for file operations, running scripts, checking system info, git commands, etc. The working directory defaults to the current process directory. Timeout defaults to 30 seconds.',
  parameters: INPUT_ARGS,
  execute: executeBash,
};
