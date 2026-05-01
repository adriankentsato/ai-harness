import { readFile, writeFile, appendFile, copyFile, mkdir, readdir, stat, unlink, rename } from 'fs/promises';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';
import type { ToolDefinition } from '../types/index';
import { validatePathSecure, validateFileSizeSecure, SecurityError } from '../utils/security';

export interface FileOpsArgs {
  operation: 'read' | 'write' | 'append' | 'copy' | 'move' | 'delete' | 'create_dir' | 'list_dir' | 'stat' | 'exists';
  path: string;
  content?: string;
  destination?: string;
  encoding?: BufferEncoding;
  create_path?: boolean;
}

async function executeFileOps(args: Record<string, unknown>): Promise<string> {
  const typedArgs = args as unknown as FileOpsArgs;
  const { operation, path, content, destination, encoding = 'utf8', create_path = false } = typedArgs;

  if (!path || typeof path !== 'string') {
    throw new Error('path is required and must be a string');
  }

  const resolvedPath = resolve(path);

  // Security validation for main path
  try {
    validatePathSecure(path);
  } catch (error) {
    if (error instanceof SecurityError) {
      throw error;
    }
    throw new Error(`Security validation failed: ${error}`);
  }

  // Security validation for destination path (for copy/move operations)
  if (destination) {
    try {
      validatePathSecure(destination);
    } catch (error) {
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new Error(`Security validation failed for destination: ${error}`);
    }
  }

  try {
    switch (operation) {
      case 'read': {
        if (!existsSync(resolvedPath)) {
          throw new Error(`File not found: ${resolvedPath}`);
        }
        const stats = await stat(resolvedPath);
        validateFileSizeSecure(stats.size);
        const data = await readFile(resolvedPath, encoding);
        return data.length > 50000 
          ? data.slice(0, 50000) + '\n... (truncated, file too large)'
          : data;
      }

      case 'write': {
        if (content === undefined) {
          throw new Error('content is required for write operation');
        }
        if (create_path) {
          await mkdir(dirname(resolvedPath), { recursive: true });
        }
        await writeFile(resolvedPath, content, encoding);
        return `Successfully wrote ${content.length} characters to ${resolvedPath}`;
      }

      case 'append': {
        if (content === undefined) {
          throw new Error('content is required for append operation');
        }
        if (create_path) {
          await mkdir(dirname(resolvedPath), { recursive: true });
        }
        await appendFile(resolvedPath, content, encoding);
        return `Successfully appended ${content.length} characters to ${resolvedPath}`;
      }

      case 'copy': {
        if (!destination) {
          throw new Error('destination is required for copy operation');
        }
        const resolvedDest = resolve(destination);
        if (create_path) {
          await mkdir(dirname(resolvedDest), { recursive: true });
        }
        await copyFile(resolvedPath, resolvedDest);
        return `Successfully copied ${resolvedPath} to ${resolvedDest}`;
      }

      case 'move': {
        if (!destination) {
          throw new Error('destination is required for move operation');
        }
        const resolvedDest = resolve(destination);
        if (create_path) {
          await mkdir(dirname(resolvedDest), { recursive: true });
        }
        await rename(resolvedPath, resolvedDest);
        return `Successfully moved ${resolvedPath} to ${resolvedDest}`;
      }

      case 'delete': {
        await unlink(resolvedPath);
        return `Successfully deleted ${resolvedPath}`;
      }

      case 'create_dir': {
        await mkdir(resolvedPath, { recursive: true });
        return `Successfully created directory: ${resolvedPath}`;
      }

      case 'list_dir': {
        if (!existsSync(resolvedPath)) {
          throw new Error(`Directory not found: ${resolvedPath}`);
        }
        const items = await readdir(resolvedPath, { withFileTypes: true });
        const itemList = items.map(item => {
          const suffix = item.isDirectory() ? '/' : '';
          return `${item.name}${suffix}`;
        });
        return `Contents of ${resolvedPath}:\n${itemList.join('\n')}`;
      }

      case 'stat': {
        if (!existsSync(resolvedPath)) {
          throw new Error(`Path not found: ${resolvedPath}`);
        }
        const stats = await stat(resolvedPath);
        const isFile = stats.isFile();
        const isDir = stats.isDirectory();
        const size = isFile ? `${stats.size} bytes` : 'N/A';
        const created = stats.birthtime.toISOString();
        const modified = stats.mtime.toISOString();
        const accessed = stats.atime.toISOString();
        
        return `Path: ${resolvedPath}
Type: ${isFile ? 'File' : isDir ? 'Directory' : 'Other'}
Size: ${size}
Created: ${created}
Modified: ${modified}
Accessed: ${accessed}`;
      }

      case 'exists': {
        const exists = existsSync(resolvedPath);
        return `${resolvedPath} ${exists ? 'exists' : 'does not exist'}`;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    const err = error as Error;
    throw new Error(`File operation failed: ${err.message}`);
  }
}

export const fileOpsTool: ToolDefinition = {
  name: 'file_ops',
  description: 'Perform native file system operations including read, write, append, copy, move, delete, create directories, list directory contents, get file stats, and check if paths exist.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['read', 'write', 'append', 'copy', 'move', 'delete', 'create_dir', 'list_dir', 'stat', 'exists'],
        description: 'The file operation to perform',
      },
      path: {
        type: 'string',
        description: 'The file or directory path to operate on',
      },
      content: {
        type: 'string',
        description: 'Content to write or append (required for write/append operations)',
      },
      destination: {
        type: 'string',
        description: 'Destination path for copy/move operations',
      },
      encoding: {
        type: 'string',
        enum: ['utf8', 'ascii', 'utf16le', 'ucs2', 'base64', 'latin1', 'binary', 'hex'],
        description: 'File encoding (default: utf8)',
      },
      create_path: {
        type: 'boolean',
        description: 'Create parent directories if they don\'t exist (default: false)',
      },
    },
    required: ['operation', 'path'],
  },
  execute: executeFileOps,
};
