import { resolve, relative, isAbsolute } from 'path';
import { tmpdir } from 'os';

/**
 * Security configuration for restricting file system access
 */
export interface SecurityConfig {
  allowedDirectories: string[];
  dangerousPaths: string[];
  dangerousCommands: string[];
  maxFileSize: number;
}

/**
 * Default security configuration
 */
export const defaultSecurityConfig: SecurityConfig = {
  allowedDirectories: [process.cwd()], // Only allow current working directory by default
  dangerousPaths: [
    // System directories
    '/etc',
    '/bin',
    '/sbin',
    '/usr/bin',
    '/usr/sbin',
    '/usr/local/bin',
    '/usr/local/sbin',
    '/System',
    '/Library',
    // User home system directories
    '~/.ssh',
    '~/.aws',
    '~/.config',
    '~/.gnupg',
    '~/.local',
    '~/.cache',
    // Application data directories
    '~/Library',
    '/Applications',
    // System temp directories (but allow OS temp dir for testing)
    '/tmp',
    '/var/tmp',
    '/dev',
    '/proc',
    '/sys',
    // Database files
    '*.db',
    '*.sqlite',
    '*.sqlite3',
    // Configuration files
    '*.env',
    '*.config',
    '*.conf',
    // Sensitive file patterns
    '*key*',
    '*secret*',
    '*password*',
    '*credential*',
    '*token*',
  ],
  dangerousCommands: [
    'rm -rf',
    'rm -r',
    'sudo',
    'su',
    'chmod 777',
    'chown',
    'dd if=',
    'mkfs',
    'fdisk',
    'format',
    'del /f',
    'rmdir /s',
    'shutdown',
    'reboot',
    'halt',
    'poweroff',
    'systemctl',
    'service',
    'crontab',
    'at ',
    'batch',
    'nohup',
    'screen',
    'tmux',
  ],
  maxFileSize: 50 * 1024 * 1024, // 50MB
};

/**
 * Validates if a path is safe to access
 */
export function validatePath(path: string, config: SecurityConfig = defaultSecurityConfig): boolean {
  const resolvedPath = resolve(path);
  
  // Check if path is within allowed directories
  const isInAllowedDirectory = config.allowedDirectories.some(allowedDir => {
    const resolvedAllowedDir = resolve(allowedDir);
    const relativePath = relative(resolvedAllowedDir, resolvedPath);
    return !relativePath.startsWith('..') && !isAbsolute(relativePath);
  });

  // Allow OS temp directory for testing
  const tempDir = tmpdir();
  if (resolvedPath.startsWith(tempDir)) {
    return true;
  }

  if (!isInAllowedDirectory) {
    return false;
  }

  // Check for dangerous system paths (only if they start with these exact paths)
  const dangerousSystemPaths = [
    '/etc/',
    '/bin/',
    '/sbin/',
    '/usr/bin/',
    '/usr/sbin/',
    '/usr/local/bin/',
    '/usr/local/sbin/',
    '/System/',
    '/Library/',
    '/dev/',
    '/proc/',
    '/sys/',
    '/tmp/',
    '/var/tmp/',
    '/Applications/',
  ];

  for (const dangerousPath of dangerousSystemPaths) {
    if (resolvedPath.startsWith(dangerousPath)) {
      return false;
    }
  }

  // Check for dangerous home directory paths
  if (path.includes('~/.ssh') || path.includes('~/.aws') || path.includes('~/.gnupg') || 
      path.includes('~/.config') || path.includes('~/.local') || path.includes('~/.cache') ||
      path.includes('~/Library')) {
    return false;
  }

  // Check for dangerous file patterns (but be more specific)
  const dangerousPatterns = [
    /\.env$/,
    /\.conf$/,
    /.*key.*/i,
    /.*secret.*/i,
    /.*password.*/i,
    /.*credential.*/i,
    /.*token.*/i,
  ];

  // Only apply dangerous patterns to files, not directories
  const isFile = !path.endsWith('/');
  if (isFile) {
    for (const pattern of dangerousPatterns) {
      if (pattern.test(path)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Normalizes a command by collapsing whitespace and lowercasing
 * This prevents bypasses using extra spaces, tabs, or newlines
 */
function normalizeCommand(command: string): string {
  return command
    .toLowerCase()
    // Collapse all whitespace (spaces, tabs, newlines) to single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts command tokens for word-boundary matching
 * Prevents bypasses like "echo; rm -rf" or "$(rm -rf)"
 */
function getCommandTokens(command: string): string[] {
  // Remove shell metacharacters and extract potential command words
  const sanitized = command
    .replace(/[;|&<>()$`{}\[\]!\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized.split(' ').filter(t => t.length > 0);
}

/**
 * Validates if a bash command is safe to execute
 */
export function validateCommand(command: string, config: SecurityConfig = defaultSecurityConfig): boolean {
  // Check for shell metacharacters that could enable injection
  const dangerousMetacharacters = [
    /[;|&]\s*(rm|sudo|su|shutdown|reboot|halt|poweroff|mkfs|fdisk|dd|chmod|chown)\b/,
    /\$\([^)]*(rm|sudo|su|shutdown|reboot|halt|poweroff)/,
    /`[^`]*(rm|sudo|su|shutdown|reboot|halt|poweroff)/,
    />\s*\/(etc|bin|sbin|usr|System|Library|dev|proc|sys)\//,
    />\s*~\/.\//,
  ];

  for (const pattern of dangerousMetacharacters) {
    if (pattern.test(command)) {
      return false;
    }
  }

  // Normalize and check for dangerous commands at start or after pipe/and/or
  const normalized = normalizeCommand(command);
  const tokens = getCommandTokens(command);

  // Check if any dangerous command appears as a top-level command
  for (const dangerousCmd of config.dangerousCommands) {
    const dangerousParts = dangerousCmd.toLowerCase().trim().split(/\s+/);
    const dangerousBase = dangerousParts[0]; // e.g., "rm" from "rm -rf"

    // Check normalized command starts with dangerous command
    if (normalized.startsWith(dangerousCmd.toLowerCase())) {
      return false;
    }

    // Check if dangerous command appears after shell operators
    const afterOperatorPattern = new RegExp(`[;&|]\\s*${dangerousBase}\\b`);
    if (afterOperatorPattern.test(normalized)) {
      // Additional check: ensure it's not part of a string/argument
      const beforeMatch = normalized.split(dangerousBase)[0];
      const lastChar = beforeMatch.slice(-1);
      // If preceded by operator or start, it's a command
      if (lastChar === ';' || lastChar === '|' || lastChar === '&' || lastChar === '' || lastChar === ' ') {
        return false;
      }
    }

    // Check tokens for dangerous base command
    const tokenIndex = tokens.indexOf(dangerousBase);
    if (tokenIndex !== -1) {
      // Check if following tokens match the dangerous pattern
      if (dangerousParts.length > 1) {
        let matches = true;
        for (let i = 1; i < dangerousParts.length; i++) {
          if (tokens[tokenIndex + i] !== dangerousParts[i]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return false;
        }
      } else {
        // Single word dangerous command
        return false;
      }
    }
  }

  // Check for file operations on dangerous system paths
  const dangerousFileOps = [
    /\b(cat|ls|find|grep|tail|head|mv|cp|rm)\s+\/(etc|bin|sbin|usr|System|Library|dev|proc|sys|tmp|var\/tmp|Applications|root)\b/,
    /\b(cat|ls|find|grep|tail|head|mv|cp|rm)\s+~\/\.(ssh|aws|gnupg|config|local|cache|Library)\b/,
    /\b(cat|ls|find|grep|tail|head|mv|cp|rm)\s+\/etc\/.*/,
    /\b(cat|ls|find|grep|tail|head|mv|cp|rm)\s+\/root.*/,
    /\bfind\s+\/\s+/,
    /\bfind\s+\/$/,
    /\bgrep\s+.*\/etc\/shadow/,
  ];

  for (const pattern of dangerousFileOps) {
    if (pattern.test(command)) {
      return false;
    }
  }

  // Check for directory traversal attempts in file operations
  const traversalPatterns = [
    /\b(cat|ls|find|grep|tail|head|mv|cp|rm)\s+.*\.\.\//,
    /\b(cat|ls|find|grep|tail|head|mv|cp|rm)\s+.*\.\.\\/,
  ];

  for (const pattern of traversalPatterns) {
    if (pattern.test(command)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates file size
 */
export function validateFileSize(size: number, config: SecurityConfig = defaultSecurityConfig): boolean {
  return size <= config.maxFileSize;
}

/**
 * Security error class
 */
export class SecurityError extends Error {
  constructor(message: string) {
    super(`Security violation: ${message}`);
    this.name = 'SecurityError';
  }
}

/**
 * Validates and throws SecurityError if validation fails
 */
export function validatePathSecure(path: string, config: SecurityConfig = defaultSecurityConfig): void {
  if (!validatePath(path, config)) {
    throw new SecurityError(`Access to path '${path}' is not allowed`);
  }
}

/**
 * Validates command and throws SecurityError if validation fails
 */
export function validateCommandSecure(command: string, config: SecurityConfig = defaultSecurityConfig): void {
  if (!validateCommand(command, config)) {
    throw new SecurityError(`Command '${command}' is not allowed`);
  }
}

/**
 * Validates file size and throws SecurityError if validation fails
 */
export function validateFileSizeSecure(size: number, config: SecurityConfig = defaultSecurityConfig): void {
  if (!validateFileSize(size, config)) {
    throw new SecurityError(`File size ${size} exceeds maximum allowed size of ${config.maxFileSize}`);
  }
}
