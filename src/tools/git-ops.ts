import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition } from '../types/index';
import { validatePathSecure, SecurityError } from '../utils/security';
import { z } from 'zod';

const execAsync = promisify(exec);

const INPUT_ARGS = z.object({
  operation: z.enum(['status', 'log', 'add', 'commit', 'push', 'pull', 'branch', 'checkout', 'diff', 'show', 'init', 'clone']).describe('The Git operation to perform'),
  files: z.array(z.string()).optional().describe('File paths for operations like add, diff (required for add, optional for diff)'),
  message: z.string().optional().describe('Commit message (required for commit operation)'),
  branch: z.string().optional().describe('Branch name for checkout, push, pull operations'),
  remote: z.string().optional().describe('Remote name for push/pull operations (default: origin)'),
  url: z.string().optional().describe('Repository URL for clone operation'),
  count: z.number().min(1).max(50).optional().describe('Number of commits to show in log (default: 10)'),
  cwd: z.string().optional().describe('Working directory (default: current directory)'),
});

async function executeGitOps(args: z.infer<typeof INPUT_ARGS>): Promise<string> {
  const { operation, files, message, branch, remote, url, count = 10, cwd } = args;

  // Validate working directory
  const workingDir = cwd || process.cwd();
  try {
    validatePathSecure(workingDir);
  } catch (error) {
    if (error instanceof SecurityError) {
      throw new SecurityError(`Working directory '${workingDir}' is not allowed for Git operations`);
    }
    throw new Error(`Working directory validation failed: ${error}`);
  }

  // Validate file paths if provided
  if (files) {
    for (const file of files) {
      try {
        validatePathSecure(file);
      } catch (error) {
        if (error instanceof SecurityError) {
          throw new SecurityError(`File path '${file}' is not allowed for Git operations`);
        }
        throw new Error(`File path validation failed: ${error}`);
      }
    }
  }

  try {
    let command = '';

    switch (operation) {
      case 'status':
        command = 'git status --porcelain';
        break;

      case 'log':
        command = `git log --oneline -${count}`;
        break;

      case 'add':
        if (!files || files.length === 0) {
          throw new Error('files are required for git add operation');
        }
        command = `git add ${files.join(' ')}`;
        break;

      case 'commit':
        if (!message) {
          throw new Error('message is required for git commit operation');
        }
        command = `git commit -m "${message.replace(/"/g, '\\"')}"`;
        break;

      case 'push':
        command = `git push ${remote || 'origin'} ${branch || 'main'}`;
        break;

      case 'pull':
        command = `git pull ${remote || 'origin'} ${branch || 'main'}`;
        break;

      case 'branch':
        command = 'git branch -a';
        break;

      case 'checkout':
        if (!branch) {
          throw new Error('branch is required for git checkout operation');
        }
        command = `git checkout ${branch}`;
        break;

      case 'diff':
        if (files && files.length > 0) {
          command = `git diff ${files.join(' ')}`;
        } else {
          command = 'git diff';
        }
        break;

      case 'show':
        command = `git show --stat`;
        break;

      case 'init':
        command = 'git init';
        break;

      case 'clone':
        if (!url) {
          throw new Error('url is required for git clone operation');
        }
        // For clone, extract the repo name from URL to create directory
        const repoName = url.split('/').pop()?.replace('.git', '') || 'repo';
        command = `git clone ${url} ${repoName}`;
        break;

      default:
        throw new Error(`Unknown git operation: ${operation}`);
    }

    const { stdout, stderr } = await execAsync(command, {
      cwd: workingDir,
      timeout: 30000,
      maxBuffer: 1024 * 1024, // 1MB buffer
    });

    const output = stdout || stderr;
    
    // Format output for better readability
    switch (operation) {
      case 'status':
        if (!output.trim()) {
          return 'Working directory is clean';
        }
        return output.trim();

      case 'log':
        if (!output.trim()) {
          return 'No commits found';
        }
        return `Recent commits:\n${output.trim()}`;

      case 'branch':
        return `Branches:\n${output.trim()}`;

      case 'add':
        return `Staged files: ${files?.join(', ')}`;

      case 'commit':
        return `Commit created: ${message}`;

      case 'push':
        return `Pushed to ${remote || 'origin'}/${branch || 'main'}`;

      case 'pull':
        return `Pulled from ${remote || 'origin'}/${branch || 'main'}`;

      case 'checkout':
        return `Switched to branch: ${branch}`;

      case 'diff':
        return output.trim() || 'No differences found';

      case 'show':
        return output.trim();

      case 'init':
        return 'Git repository initialized';

      case 'clone':
        return `Repository cloned from ${url}`;

      default:
        return output.trim();
    }
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string };
    const output = err.stdout || err.stderr || err.message;
    throw new Error(`Git operation failed: ${output}`);
  }
}

export const gitOpsTool: ToolDefinition<z.infer<typeof INPUT_ARGS>, string> = {
  name: 'git_ops',
  description: 'Perform Git operations with strict working directory restrictions. Supports status, log, add, commit, push, pull, branch, checkout, diff, show, init, and clone operations.',
  parameters: INPUT_ARGS,
  execute: executeGitOps,
};
