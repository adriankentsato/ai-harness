import { describe, it, expect } from 'vitest';
import { processOpsTool } from '../process-ops';

describe('processOpsTool', () => {
  it('should list processes', async () => {
    const result = await processOpsTool.execute({
      operation: 'list'
    });
    expect(result).toContain('processes');
  });

  it('should get node version', async () => {
    const result = await processOpsTool.execute({
      operation: 'node_version'
    });
    expect(result).toContain('Node.js version');
  });

  it('should get npm version', async () => {
    const result = await processOpsTool.execute({
      operation: 'npm_version'
    });
    expect(result).toContain('npm version');
  });

  it('should get python version', async () => {
    const result = await processOpsTool.execute({
      operation: 'python_version'
    });
    expect(result).toContain('Python version');
  });

  it('should get system info', async () => {
    const result = await processOpsTool.execute({
      operation: 'system_info'
    });
    expect(result).toContain('System information');
  });

  it('should reject operations outside allowed directories', async () => {
    await expect(processOpsTool.execute({
      operation: 'list',
      cwd: '/etc'
    })).rejects.toThrow('Security violation');
  });

  it('should require pid for kill operation', async () => {
    await expect(processOpsTool.execute({
      operation: 'kill'
    })).rejects.toThrow('pid is required');
  });

  it('should validate pid range for kill operation', async () => {
    await expect(processOpsTool.execute({
      operation: 'kill',
      pid: 1000000
    })).rejects.toThrow(/pid must be between 1 and 999999/);
  });

  it('should require pid for info operation', async () => {
    await expect(processOpsTool.execute({
      operation: 'info'
    })).rejects.toThrow('pid is required');
  });

  it('should validate pid range for info operation', async () => {
    await expect(processOpsTool.execute({
      operation: 'info',
      pid: 1000000
    })).rejects.toThrow('pid must be between 1 and 999999');
  });

  it('should reject invalid operation', async () => {
    await expect(processOpsTool.execute({
      operation: 'invalid' as any
    })).rejects.toThrow('Unknown process operation');
  });
});
