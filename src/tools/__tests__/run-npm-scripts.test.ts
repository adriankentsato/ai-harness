import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock util.promisify to return object shape { stdout, stderr }
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('util')>();
  return {
    ...actual,
    promisify: (fn: Parameters<typeof import('util')['promisify']>[0]) => {
      return async (command: string, options: Record<string, unknown>) => {
        return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
          fn(command, options, (error: Error | null, stdout: string, stderr: string) => {
            if (error) reject(error);
            else resolve({ stdout, stderr });
          });
        });
      };
    },
  };
});

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((_command: string, _options: any, callback: any) => {
    callback(null, 'Script executed successfully', '');
    return {} as ReturnType<typeof import('child_process')['exec']>;
  }) as unknown as typeof import('child_process').exec
}));

import { runNpmScriptsTool } from '../run-npm-scripts';
import { exec } from 'child_process';

vi.mock('fs/promises', () => ({
  readFile: vi.fn((path: string) => {
    if (path?.includes('package.json')) {
      return Promise.resolve(JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          test: 'echo "Running tests"',
          build: 'echo "Building project"',
          start: 'echo "Starting server"',
          dev: 'echo "Starting dev server"'
        }
      }));
    }
    return Promise.reject(new Error('File not found'));
  })
}));

vi.mock('../utils/security', () => ({
  validatePathSecure: vi.fn(() => true),
  SecurityError: class SecurityError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'SecurityError';
    }
  }
}));

describe('runNpmScriptsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exec).mockImplementation((_command: string, _options: any, callback: any) => {
      callback(null, 'Script executed successfully', '');
      return {} as ReturnType<typeof import('child_process')['exec']>;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should list available scripts', async () => {
    const result = await runNpmScriptsTool.execute({
      operation: 'list',
      cwd: './test-dir'
    });
    
    expect(result).toContain('Available npm scripts');
    expect(result).toContain('test');
    expect(result).toContain('build');
    expect(result).toContain('start');
    expect(result).toContain('dev');
  });

  it('should handle no scripts in package.json', async () => {
    const { readFile } = await import('fs/promises');
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({
      name: 'test-project',
      version: '1.0.0'
    }));

    const result = await runNpmScriptsTool.execute({
      operation: 'list',
      cwd: './test-dir'
    });
    
    expect(result).toBe('No npm scripts found in package.json');
  });

  it('should run a specific script', async () => {
    const result = await runNpmScriptsTool.execute({
      operation: 'run',
      script: 'test',
      cwd: './test-dir'
    });
    
    expect(result).toContain('Script \'test\' executed');
  });

  it('should run npm install', async () => {
    const result = await runNpmScriptsTool.execute({
      operation: 'install',
      cwd: './test-dir'
    });
    
    expect(result).toContain('npm install completed');
  });

  it('should run npm test', async () => {
    const result = await runNpmScriptsTool.execute({
      operation: 'test',
      cwd: './test-dir'
    });
    
    expect(result).toContain('npm test completed');
  });

  it('should run npm build', async () => {
    const result = await runNpmScriptsTool.execute({
      operation: 'build',
      cwd: './test-dir'
    });
    
    expect(result).toContain('npm build completed');
  });

  it('should run npm start', async () => {
    const result = await runNpmScriptsTool.execute({
      operation: 'start',
      cwd: './test-dir'
    });
    
    expect(result).toContain('npm start executed');
  });

  it('should run npm dev', async () => {
    const result = await runNpmScriptsTool.execute({
      operation: 'dev',
      cwd: './test-dir'
    });
    
    expect(result).toContain('npm dev executed');
  });

  it('should require script name for run operation', async () => {
    await expect(runNpmScriptsTool.execute({
      operation: 'run',
      cwd: './test-dir'
    })).rejects.toThrow('script name is required for run operation');
  });

  it('should validate script name format', async () => {
    await expect(runNpmScriptsTool.execute({
      operation: 'run',
      script: 'invalid-script-name!',
      cwd: './test-dir'
    })).rejects.toThrow('Script name can only contain letters, numbers, hyphens, and underscores');
  });

  it('should validate script arguments', async () => {
    await expect(runNpmScriptsTool.execute({
      operation: 'run',
      script: 'test',
      args: ['../../etc/passwd'],
      cwd: './test-dir'
    })).rejects.toThrow('Invalid script argument: ../../etc/passwd');
  });

  it('should handle missing package.json', async () => {
    const { readFile } = await import('fs/promises');
    vi.mocked(readFile).mockRejectedValueOnce(new Error('File not found'));

    const result = await runNpmScriptsTool.execute({
      operation: 'list',
      cwd: './nonexistent-directory'
    });
    
    expect(result).toBe('No package.json found or unable to read scripts');
  });

  it('should handle missing script', async () => {
    vi.mocked(exec).mockImplementationOnce((_command: string, _options: any, callback: any) => {
      callback(new Error('Missing script: "nonexistent"'), '', 'Missing script: "nonexistent"');
      return {} as ReturnType<typeof import('child_process')['exec']>;
    });

    await expect(runNpmScriptsTool.execute({
      operation: 'run',
      script: 'nonexistent',
      cwd: './test-dir'
    })).rejects.toThrow('Script \'nonexistent\' not found in package.json');
  });

  it('should reject invalid operation', async () => {
    await expect(runNpmScriptsTool.execute({
      operation: 'invalid' as string,
      cwd: './test-dir'
    })).rejects.toThrow('Unknown npm operation: invalid');
  });

  it('should pass script arguments correctly', async () => {
    await runNpmScriptsTool.execute({
      operation: 'run',
      script: 'test',
      args: ['--coverage', '--verbose'],
      cwd: './test-dir'
    });

    expect(exec).toHaveBeenCalledWith(
      'npm run test -- --coverage --verbose',
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('should handle npm not found error', async () => {
    vi.mocked(exec).mockImplementationOnce((_command: string, _options: any, callback: any) => {
      callback(new Error('ENOENT: command not found'), '', 'ENOENT: command not found');
      return {} as ReturnType<typeof import('child_process')['exec']>;
    });

    await expect(runNpmScriptsTool.execute({
      operation: 'test',
      cwd: './test-dir'
    })).rejects.toThrow('npm not found. Please ensure Node.js and npm are installed.');
  });
});
