import { describe, it, expect } from 'vitest';
import { bashTool } from '../../tools/bash';
import { fileOpsTool } from '../../tools/file-ops';

describe('Security Integration Tests', () => {
  describe('Bash Tool Security', () => {
    it('should allow safe commands', async () => {
      const result = await bashTool.execute({ command: 'echo "hello world"' });
      expect(result).toContain('hello world');
    });

    it('should reject dangerous commands', async () => {
      await expect(bashTool.execute({ command: 'rm -rf /' })).rejects.toThrow('Security violation');
      await expect(bashTool.execute({ command: 'sudo su' })).rejects.toThrow('Security violation');
      await expect(bashTool.execute({ command: 'shutdown now' })).rejects.toThrow('Security violation');
    });

    it('should reject file operations on system paths', async () => {
      await expect(bashTool.execute({ command: 'cat /etc/passwd' })).rejects.toThrow('Security violation');
      await expect(bashTool.execute({ command: 'ls /root' })).rejects.toThrow('Security violation');
      await expect(bashTool.execute({ command: 'find / -name "*.txt"' })).rejects.toThrow('Security violation');
    });

    it('should reject directory traversal attempts', async () => {
      await expect(bashTool.execute({ command: 'cat ../../etc/passwd' })).rejects.toThrow('Security violation');
      await expect(bashTool.execute({ command: 'ls ../../../root' })).rejects.toThrow('Security violation');
    });
  });

  describe('File Operations Tool Security', () => {
    it('should allow operations within current directory', async () => {
      const result = await fileOpsTool.execute({ 
        operation: 'exists', 
        path: './package.json' 
      });
      expect(result).toContain('exists');
    });

    it('should reject access to system files', async () => {
      await expect(fileOpsTool.execute({ 
        operation: 'read', 
        path: '/etc/passwd' 
      })).rejects.toThrow('Security violation');

      await expect(fileOpsTool.execute({ 
        operation: 'stat', 
        path: '/etc/hosts' 
      })).rejects.toThrow('Security violation');
    });

    it('should reject access to sensitive home directory files', async () => {
      await expect(fileOpsTool.execute({ 
        operation: 'read', 
        path: '~/.ssh/id_rsa' 
      })).rejects.toThrow('Security violation');

      await expect(fileOpsTool.execute({ 
        operation: 'read', 
        path: '~/.aws/credentials' 
      })).rejects.toThrow('Security violation');
    });

    it('should reject operations on dangerous file patterns', async () => {
      await expect(fileOpsTool.execute({ 
        operation: 'write', 
        path: 'secrets.env',
        content: 'SECRET=123' 
      })).rejects.toThrow('Security violation');

      await expect(fileOpsTool.execute({ 
        operation: 'read', 
        path: 'api_key.txt' 
      })).rejects.toThrow('Security violation');
    });

    it('should reject directory traversal in file paths', async () => {
      await expect(fileOpsTool.execute({ 
        operation: 'read', 
        path: '../../etc/passwd' 
      })).rejects.toThrow('Security violation');
    });

    it('should reject copy/move to dangerous destinations', async () => {
      await expect(fileOpsTool.execute({ 
        operation: 'copy', 
        path: './test.txt',
        destination: '/etc/malicious' 
      })).rejects.toThrow('Security violation');
    });
  });
});
