import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { databaseUserTool, resetDatabase } from '../../tools/database-user';
import { mkdir, rm } from 'fs/promises';

describe('Database User Tool Security', () => {
  beforeEach(async () => {
    // Create data directory for default database
    await mkdir('./data', { recursive: true });
  });

  afterEach(async () => {
    // Reset database instance to clear cached paths
    resetDatabase();
    // Clean up data directory
    await rm('./data', { recursive: true, force: true });
  });

  it('should allow operations within current directory', async () => {
    // Test with default path (should be allowed)
    const result = await databaseUserTool.execute({
      operation: 'get_all_users'
    });
    expect(result).toContain('[]'); // Should return empty array for new database
  });

  it('should reject database operations on system paths', async () => {
    // Test dangerous database path via environment variable
    const originalDbPath = process.env.DB_PATH;
    
    try {
      process.env.DB_PATH = '/etc/malicious.db';
      
      await expect(databaseUserTool.execute({
        operation: 'get_all_users'
      })).rejects.toThrow('Database path');
    } finally {
      // Restore original environment
      if (originalDbPath !== undefined) {
        process.env.DB_PATH = originalDbPath;
      } else {
        delete process.env.DB_PATH;
      }
    }
  });

  it('should reject database operations on home directory sensitive files', async () => {
    const originalDbPath = process.env.DB_PATH;
    
    try {
      process.env.DB_PATH = '~/.ssh/users.db';
      
      await expect(databaseUserTool.execute({
        operation: 'get_all_users'
      })).rejects.toThrow('Database path');
    } finally {
      if (originalDbPath !== undefined) {
        process.env.DB_PATH = originalDbPath;
      } else {
        delete process.env.DB_PATH;
      }
    }
  });

  it('should reject database operations with dangerous file patterns', async () => {
    const originalDbPath = process.env.DB_PATH;
    
    try {
      process.env.DB_PATH = 'secrets.db';
      
      await expect(databaseUserTool.execute({
        operation: 'get_all_users'
      })).rejects.toThrow('Database path');
    } finally {
      if (originalDbPath !== undefined) {
        process.env.DB_PATH = originalDbPath;
      } else {
        delete process.env.DB_PATH;
      }
    }
  });

  it('should allow database operations in temp directory for testing', async () => {
    const originalDbPath = process.env.DB_PATH;
    
    try {
      // Use temp directory which should be allowed
      const { tmpdir } = require('os');
      const { join } = require('path');
      process.env.DB_PATH = join(tmpdir(), 'test-users.db');
      
      const result = await databaseUserTool.execute({
        operation: 'get_all_users'
      });
      expect(result).toContain('[]'); // Should return empty array for new database
    } finally {
      if (originalDbPath !== undefined) {
        process.env.DB_PATH = originalDbPath;
      } else {
        delete process.env.DB_PATH;
      }
    }
  });
});
