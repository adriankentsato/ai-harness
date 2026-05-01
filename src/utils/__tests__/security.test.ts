import { describe, it, expect } from 'vitest';
import {
  validatePath,
  validateCommand,
  validateFileSize,
  validatePathSecure,
  validateCommandSecure,
  validateFileSizeSecure,
  SecurityError,
  defaultSecurityConfig,
} from '../security';

describe('Security Validation', () => {
  describe('validatePath', () => {
    it('should allow access to current working directory', () => {
      expect(validatePath('./test.txt')).toBe(true);
      expect(validatePath('test.txt')).toBe(true);
      expect(validatePath('./subdir/test.txt')).toBe(true);
    });

    it('should reject access to system directories', () => {
      expect(validatePath('/etc/passwd')).toBe(false);
      expect(validatePath('/bin/bash')).toBe(false);
      expect(validatePath('/usr/bin/node')).toBe(false);
      expect(validatePath('/System/Library')).toBe(false);
    });

    it('should reject access to home directory system files', () => {
      expect(validatePath('~/.ssh/id_rsa')).toBe(false);
      expect(validatePath('~/.aws/credentials')).toBe(false);
      expect(validatePath('~/.config')).toBe(false);
    });

    it('should reject dangerous file patterns', () => {
      expect(validatePath('secrets.db')).toBe(false);
      expect(validatePath('config.env')).toBe(false);
      expect(validatePath('api_key.txt')).toBe(false);
      expect(validatePath('passwords.json')).toBe(false);
    });

    it('should reject paths with dangerous patterns', () => {
      expect(validatePath('/etc/hosts')).toBe(false);
      expect(validatePath('/tmp/malicious')).toBe(false);
      expect(validatePath('/dev/null')).toBe(false);
    });
  });

  describe('validateCommand', () => {
    it('should allow safe commands', () => {
      expect(validateCommand('ls -la')).toBe(true);
      expect(validateCommand('echo "hello"')).toBe(true);
      expect(validateCommand('cat test.txt')).toBe(true);
      expect(validateCommand('node --version')).toBe(true);
    });

    it('should reject dangerous commands', () => {
      expect(validateCommand('rm -rf /')).toBe(false);
      expect(validateCommand('sudo rm -rf')).toBe(false);
      expect(validateCommand('chmod 777')).toBe(false);
      expect(validateCommand('shutdown now')).toBe(false);
      expect(validateCommand('reboot')).toBe(false);
    });

    it('should reject file operations on system paths', () => {
      expect(validateCommand('cat /etc/passwd')).toBe(false);
      expect(validateCommand('ls /root')).toBe(false);
      expect(validateCommand('find / -name')).toBe(false);
      expect(validateCommand('grep password /etc/shadow')).toBe(false);
    });

    it('should reject directory traversal attempts', () => {
      expect(validateCommand('cat ../../etc/passwd')).toBe(false);
      expect(validateCommand('ls ../../../root')).toBe(false);
      expect(validateCommand('tail ~/.ssh/id_rsa')).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    it('should allow files within size limit', () => {
      expect(validateFileSize(1024)).toBe(true);
      expect(validateFileSize(1024 * 1024)).toBe(true); // 1MB
      expect(validateFileSize(40 * 1024 * 1024)).toBe(true); // 40MB
    });

    it('should reject files exceeding size limit', () => {
      expect(validateFileSize(60 * 1024 * 1024)).toBe(false); // 60MB
      expect(validateFileSize(100 * 1024 * 1024)).toBe(false); // 100MB
    });
  });

  describe('Secure validation functions (throwing)', () => {
    it('should throw SecurityError for invalid paths', () => {
      expect(() => validatePathSecure('/etc/passwd')).toThrow(SecurityError);
      expect(() => validatePathSecure('~/.ssh/id_rsa')).toThrow(SecurityError);
      expect(() => validatePathSecure('secrets.db')).toThrow(SecurityError);
    });

    it('should not throw for valid paths', () => {
      expect(() => validatePathSecure('./test.txt')).not.toThrow();
      expect(() => validatePathSecure('subdir/file.txt')).not.toThrow();
    });

    it('should throw SecurityError for invalid commands', () => {
      expect(() => validateCommandSecure('rm -rf /')).toThrow(SecurityError);
      expect(() => validateCommandSecure('cat /etc/passwd')).toThrow(SecurityError);
      expect(() => validateCommandSecure('sudo su')).toThrow(SecurityError);
    });

    it('should not throw for valid commands', () => {
      expect(() => validateCommandSecure('ls -la')).not.toThrow();
      expect(() => validateCommandSecure('echo hello')).not.toThrow();
    });

    it('should throw SecurityError for invalid file sizes', () => {
      expect(() => validateFileSizeSecure(100 * 1024 * 1024)).toThrow(SecurityError);
    });

    it('should not throw for valid file sizes', () => {
      expect(() => validateFileSizeSecure(1024)).not.toThrow();
      expect(() => validateFileSizeSecure(10 * 1024 * 1024)).not.toThrow();
    });
  });

  describe('SecurityError', () => {
    it('should create SecurityError with proper message', () => {
      const error = new SecurityError('Test message');
      expect(error.name).toBe('SecurityError');
      expect(error.message).toBe('Security violation: Test message');
    });
  });

  describe('defaultSecurityConfig', () => {
    it('should have proper default configuration', () => {
      expect(defaultSecurityConfig.allowedDirectories).toContain(process.cwd());
      expect(defaultSecurityConfig.dangerousPaths).toContain('/etc');
      expect(defaultSecurityConfig.dangerousPaths).toContain('~/.ssh');
      expect(defaultSecurityConfig.dangerousCommands).toContain('rm -rf');
      expect(defaultSecurityConfig.dangerousCommands).toContain('sudo');
      expect(defaultSecurityConfig.maxFileSize).toBe(50 * 1024 * 1024);
    });
  });
});
