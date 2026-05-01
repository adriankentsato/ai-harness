import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fileOpsTool } from '../file-ops';
import { mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('fileOpsTool', () => {
  const testDir = join(tmpdir(), 'shty-harness-test');
  const testFile = join(testDir, 'test.txt');
  const testContent = 'Hello, World!';

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should write and read files', async () => {
    await fileOpsTool.execute({
      operation: 'write',
      path: testFile,
      content: testContent,
    });

    const result = await fileOpsTool.execute({
      operation: 'read',
      path: testFile,
    });

    expect(result).toBe(testContent);
  });

  it('should append to files', async () => {
    await fileOpsTool.execute({
      operation: 'write',
      path: testFile,
      content: testContent,
    });

    await fileOpsTool.execute({
      operation: 'append',
      path: testFile,
      content: ' Appended!',
    });

    const result = await fileOpsTool.execute({
      operation: 'read',
      path: testFile,
    });

    expect(result).toBe('Hello, World! Appended!');
  });

  it('should check if files exist', async () => {
    const notExistsResult = await fileOpsTool.execute({
      operation: 'exists',
      path: testFile,
    });
    expect(notExistsResult).toContain('does not exist');

    await fileOpsTool.execute({
      operation: 'write',
      path: testFile,
      content: testContent,
    });

    const existsResult = await fileOpsTool.execute({
      operation: 'exists',
      path: testFile,
    });
    expect(existsResult).toContain('exists');
  });

  it('should get file stats', async () => {
    await fileOpsTool.execute({
      operation: 'write',
      path: testFile,
      content: testContent,
    });

    const result = await fileOpsTool.execute({
      operation: 'stat',
      path: testFile,
    });

    expect(result).toContain('Type: File');
    expect(result).toContain('Size: 13 bytes');
    expect(result).toContain(testFile);
  });

  it('should list directory contents', async () => {
    await fileOpsTool.execute({
      operation: 'write',
      path: testFile,
      content: testContent,
    });

    const result = await fileOpsTool.execute({
      operation: 'list_dir',
      path: testDir,
    });

    expect(result).toContain('Contents of');
    expect(result).toContain('test.txt');
  });

  it('should copy files', async () => {
    const destFile = join(testDir, 'copied.txt');

    await fileOpsTool.execute({
      operation: 'write',
      path: testFile,
      content: testContent,
    });

    await fileOpsTool.execute({
      operation: 'copy',
      path: testFile,
      destination: destFile,
    });

    const result = await fileOpsTool.execute({
      operation: 'read',
      path: destFile,
    });

    expect(result).toBe(testContent);
  });

  it('should delete files', async () => {
    await fileOpsTool.execute({
      operation: 'write',
      path: testFile,
      content: testContent,
    });

    await fileOpsTool.execute({
      operation: 'delete',
      path: testFile,
    });

    const existsResult = await fileOpsTool.execute({
      operation: 'exists',
      path: testFile,
    });

    expect(existsResult).toContain('does not exist');
  });

  it('should create directories', async () => {
    const newDir = join(testDir, 'new-directory');

    const result = await fileOpsTool.execute({
      operation: 'create_dir',
      path: newDir,
    });

    expect(result).toContain('Successfully created directory');
    expect(result).toContain(newDir);
  });

  it('should handle errors gracefully', async () => {
    await expect(
      fileOpsTool.execute({
        operation: 'read',
        path: '/nonexistent/file.txt',
      })
    ).rejects.toThrow(/File operation failed|Security violation/);
  });
});
