import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import type { ToolDefinition } from '../types/index';
import { validatePathSecure, SecurityError } from '../utils/security';
import { z } from 'zod';

const execAsync = promisify(exec);

const INPUT_ARGS = z.object({
  operation: z.enum(['list', 'run', 'install', 'test', 'build', 'start', 'dev']).describe('The npm operation to perform'),
  script: z.string().optional().describe('Script name to run (required for run operation)'),
  args: z.array(z.string()).optional().describe('Arguments to pass to the npm script'),
  cwd: z.string().optional().describe('Working directory (default: current directory)'),
  timeout: z.number().min(5000).max(300000).optional().describe('Timeout in milliseconds (default: 60000)'),
});

async function executeRunNpmScripts(args: z.infer<typeof INPUT_ARGS>): Promise<string> {
  const { operation, script, args: scriptArgs = [], cwd, timeout = 60000 } = args;

  // Validate working directory
  const workingDir = cwd || process.cwd();
  try {
    validatePathSecure(workingDir);
  } catch (error) {
    if (error instanceof SecurityError) {
      throw new SecurityError(`Working directory '${workingDir}' is not allowed for npm operations`);
    }
    throw new Error(`Working directory validation failed: ${error}`);
  }

  try {
    let command = '';
    let packageJsonPath = '';

    switch (operation) {
      case 'list':
        // Read package.json to list available scripts
        packageJsonPath = `${workingDir}/package.json`;
        try {
          validatePathSecure(packageJsonPath);
          const packageJson = await readFile(packageJsonPath, 'utf8');
          const packageData = JSON.parse(packageJson);
          const scripts = packageData.scripts || {};
          
          if (Object.keys(scripts).length === 0) {
            return 'No npm scripts found in package.json';
          }
          
          let output = 'Available npm scripts:\n';
          Object.entries(scripts).forEach(([name, scriptCmd]) => {
            output += `  ${name}: ${scriptCmd}\n`;
          });
          return output.trim();
        } catch (readError) {
          if (readError instanceof SecurityError) {
            throw readError;
          }
          return 'No package.json found or unable to read scripts';
        }

      case 'run':
        if (!script) {
          throw new Error('script name is required for run operation');
        }
        
        // Validate script name doesn't contain dangerous characters
        if (!/^[a-zA-Z0-9_-]+$/.test(script)) {
          throw new Error('Script name can only contain letters, numbers, hyphens, and underscores');
        }
        
        // Validate script arguments
        for (const arg of scriptArgs) {
          if (typeof arg !== 'string' || arg.includes('..') || arg.includes('/') || arg.includes('\\')) {
            throw new Error(`Invalid script argument: ${arg}`);
          }
        }
        
        command = `npm run ${script}`;
        if (scriptArgs.length > 0) {
          command += ` -- ${scriptArgs.join(' ')}`;
        }
        break;

      case 'install':
        command = 'npm install --no-audit --no-fund';
        break;

      case 'test':
        command = 'npm test';
        break;

      case 'build':
        command = 'npm run build';
        break;

      case 'start':
        command = 'npm start';
        break;

      case 'dev':
        command = 'npm run dev';
        break;

      default:
        throw new Error(`Unknown npm operation: ${operation}`);
    }

    // For operations that run commands (not list), execute with timeout
    if (command) {
      const result = await execAsync(command, {
        cwd: workingDir,
        timeout,
        maxBuffer: 2 * 1024 * 1024, // 2MB buffer for npm output
        env: {
          ...process.env,
          // Disable some npm features for security
          npm_config_audit: 'false',
          npm_config_fund: 'false',
          npm_config_update_notifier: 'false',
        },
      }) as { stdout: string; stderr: string } | [string, string];

      const stdout = Array.isArray(result) ? result[0] : result.stdout;
      const stderr = Array.isArray(result) ? result[1] : result.stderr;
      const output = stdout || stderr;

      // Format output
      switch (operation) {
        case 'run':
          return `Script '${script}' executed:\n${output.trim()}`;

        case 'install':
          return `npm install completed:\n${output.trim()}`;

        case 'test':
          return `npm test completed:\n${output.trim()}`;

        case 'build':
          return `npm build completed:\n${output.trim()}`;

        case 'start':
          return `npm start executed:\n${output.trim()}`;

        case 'dev':
          return `npm dev executed:\n${output.trim()}`;

        default:
          return output.trim();
      }
    }

    return '';
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string };
    const output = err.stdout || err.stderr || err.message;
    
    // Handle common npm errors
    if (output.includes('ENOENT')) {
      throw new Error('npm not found. Please ensure Node.js and npm are installed.');
    }
    
    if (output.includes('Missing script')) {
      throw new Error(`Script '${script}' not found in package.json`);
    }
    
    if (output.includes('ENOTDIR') || output.includes('ENOENT')) {
      throw new Error(`Invalid working directory or package.json not found in ${workingDir}`);
    }
    
    throw new Error(`npm operation failed: ${output}`);
  }
}

export const runNpmScriptsTool: ToolDefinition<z.infer<typeof INPUT_ARGS>, string> = {
  name: 'run_npm_scripts',
  description: 'Execute npm scripts and package management operations with strict working directory restrictions. Supports listing scripts, running custom scripts, install, test, build, start, and dev operations.',
  parameters: INPUT_ARGS,
  execute: executeRunNpmScripts,
};
