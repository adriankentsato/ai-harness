import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition } from '../types/index';
import { validatePathSecure, SecurityError } from '../utils/security';
import { z } from 'zod';

const execAsync = promisify(exec);

export interface ProcessOpsArgs {
  operation: 'list' | 'kill' | 'info' | 'node_version' | 'npm_version' | 'python_version' | 'system_info';
  pid?: number;
  signal?: 'SIGTERM' | 'SIGKILL' | 'SIGINT';
  cwd?: string;
}

async function executeProcessOps(args: Record<string, unknown>): Promise<string> {
  const typedArgs = args as unknown as ProcessOpsArgs;
  const { operation, pid, signal = 'SIGTERM', cwd } = typedArgs;

  // Validate working directory
  const workingDir = cwd || process.cwd();
  try {
    validatePathSecure(workingDir);
  } catch (error) {
    if (error instanceof SecurityError) {
      throw new SecurityError(`Working directory '${workingDir}' is not allowed for process operations`);
    }
    throw new Error(`Working directory validation failed: ${error}`);
  }

  try {
    let command = '';

    switch (operation) {
      case 'list':
        // List processes - safe, read-only operation
        if (process.platform === 'win32') {
          command = 'tasklist /fo csv | findstr /v "Image Name"';
        } else {
          command = 'ps aux | head -20'; // Limit to first 20 processes
        }
        break;

      case 'kill':
        if (!pid) {
          throw new Error('pid is required for kill operation');
        }
        if (pid < 1 || pid > 999999) {
          throw new Error('pid must be between 1 and 999999');
        }
        
        // Only allow killing processes owned by current user for security
        if (process.platform === 'win32') {
          command = `taskkill /PID ${pid} /F`;
        } else {
          // Check if process belongs to current user first
          command = `ps -o pid,user -p ${pid} | grep -v "PID" | grep "$USER" && kill -${signal} ${pid} 2>/dev/null || echo "Cannot kill process: not owned by current user or process not found"`;
        }
        break;

      case 'info':
        if (!pid) {
          throw new Error('pid is required for info operation');
        }
        if (pid < 1 || pid > 999999) {
          throw new Error('pid must be between 1 and 999999');
        }
        
        if (process.platform === 'win32') {
          command = `tasklist /FI "PID eq ${pid}" /FO CSV`;
        } else {
          command = `ps -p ${pid} -o pid,ppid,user,cmd,etime,pcpu,pmem 2>/dev/null || echo "Process not found"`;
        }
        break;

      case 'node_version':
        command = 'node --version';
        break;

      case 'npm_version':
        command = 'npm --version';
        break;

      case 'python_version':
        command = 'python3 --version 2>/dev/null || python --version 2>/dev/null || echo "Python not found"';
        break;

      case 'system_info':
        // Safe system information gathering
        if (process.platform === 'win32') {
          command = 'systeminfo | findstr /C:"Total Physical Memory" /C:"Available Physical Memory" /C:"OS Name" /C:"OS Version"';
        } else {
          command = 'uname -a && df -h . && free -h 2>/dev/null || echo "Memory info not available"';
        }
        break;

      default:
        throw new Error(`Unknown process operation: ${operation}`);
    }

    const { stdout, stderr } = await execAsync(command, {
      cwd: workingDir,
      timeout: 10000, // Shorter timeout for process ops
      maxBuffer: 512 * 1024, // 512KB buffer
    });

    const output = stdout || stderr;

    // Format output for better readability
    switch (operation) {
      case 'list':
        if (!output.trim()) {
          return 'No processes found';
        }
        return `Running processes:\n${output.trim()}`;

      case 'kill':
        if (output.includes('Cannot kill process')) {
          return output.trim();
        }
        return `Process ${pid} killed with signal ${signal}`;

      case 'info':
        if (!output.trim() || output.includes('Process not found')) {
          return `Process ${pid} not found`;
        }
        return `Process ${pid} information:\n${output.trim()}`;

      case 'node_version':
        return `Node.js version: ${output.trim()}`;

      case 'npm_version':
        return `npm version: ${output.trim()}`;

      case 'python_version':
        return `Python version: ${output.trim()}`;

      case 'system_info':
        return `System information:\n${output.trim()}`;

      default:
        return output.trim();
    }
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string };
    const output = err.stdout || err.stderr || err.message;
    throw new Error(`Process operation failed: ${output}`);
  }
}

export const processOpsTool: ToolDefinition = {
  name: 'process_ops',
  description: 'Perform safe process operations with strict working directory restrictions. Supports listing processes, killing processes, getting process info, and checking tool versions.',
  parameters: z.object({
    operation: z.enum(['list', 'kill', 'info', 'node_version', 'npm_version', 'python_version', 'system_info']).describe('The process operation to perform'),
    pid: z.number().min(1).max(999999).optional().describe('Process ID for kill/info operations'),
    signal: z.enum(['SIGTERM', 'SIGKILL', 'SIGINT']).optional().describe('Signal to send for kill operation (default: SIGTERM)'),
    cwd: z.string().optional().describe('Working directory (default: current directory)'),
  }),
  execute: executeProcessOps,
};
