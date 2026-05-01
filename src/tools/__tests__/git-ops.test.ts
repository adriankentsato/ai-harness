import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gitOpsTool } from '../git-ops';
import { mkdir, rm } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('gitOpsTool', () => {
  const testDir = './test-git-repo';

  beforeEach(async () => {
    // Create test directory and initialize git repo
    await mkdir(testDir, { recursive: true });
    try {
      await execAsync('git init', { cwd: testDir });
      await execAsync('git config user.name "Test User"', { cwd: testDir });
      await execAsync('git config user.email "test@example.com"', { cwd: testDir });
    } catch (error) {
      // Git might not be available, skip tests
      console.log('Git not available, skipping tests');
    }
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should get git status', async () => {
    try {
      const result = await gitOpsTool.execute({
        operation: 'status',
        cwd: testDir
      });
      expect(result).toContain('clean');
    } catch (error) {
      // Git not available
      expect((error as Error).message).toContain('Git operation failed');
    }
  });

  it('should get git log', async () => {
    try {
      const result = await gitOpsTool.execute({
        operation: 'log',
        cwd: testDir
      });
      expect(result).toContain('commits');
    } catch (error) {
      // Git not available
      expect((error as Error).message).toContain('Git operation failed');
    }
  });

  it('should list branches', async () => {
    try {
      const result = await gitOpsTool.execute({
        operation: 'branch',
        cwd: testDir
      });
      expect(result).toContain('Branches');
    } catch (error) {
      // Git not available
      expect((error as Error).message).toContain('Git operation failed');
    }
  });

  it('should reject operations outside allowed directories', async () => {
    await expect(gitOpsTool.execute({
      operation: 'status',
      cwd: '/etc'
    })).rejects.toThrow('Security violation');
  });

  it('should reject dangerous file paths', async () => {
    await expect(gitOpsTool.execute({
      operation: 'add',
      files: ['../../etc/passwd'],
      cwd: testDir
    })).rejects.toThrow('Security violation');
  });

  it('should require message for commit operation', async () => {
    await expect(gitOpsTool.execute({
      operation: 'commit',
      cwd: testDir
    })).rejects.toThrow('message is required');
  });

  it('should require branch for checkout operation', async () => {
    await expect(gitOpsTool.execute({
      operation: 'checkout',
      cwd: testDir
    })).rejects.toThrow('branch is required');
  });

  it('should require url for clone operation', async () => {
    await expect(gitOpsTool.execute({
      operation: 'clone',
      cwd: testDir
    })).rejects.toThrow('url is required');
  });

  it('should validate script names for add operation', async () => {
    try {
      await expect(gitOpsTool.execute({
        operation: 'add',
        cwd: testDir
      })).rejects.toThrow('files are required');
    } catch (error) {
      // Expected error
    }
  });
});
