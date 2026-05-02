import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import type { ToolDefinition } from '../types/index';
import { validatePathSecure, SecurityError } from '../utils/security';
import { z } from 'zod';

export interface DatabaseUserArgs {
  operation: 'get_user_by_id' | 'get_user_by_email' | 'get_all_users' | 'create_user' | 'update_user' | 'delete_user';
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  isActive?: boolean;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

let dbInstance: Database.Database | null = null;

function getDbPath(): string {
  const dbPath = process.env.DB_PATH || './data/users.db';
  
  // Security validation for database path
  try {
    validatePathSecure(dbPath);
  } catch (error) {
    if (error instanceof SecurityError) {
      throw new SecurityError(`Database path '${dbPath}' is not allowed for security reasons`);
    }
    throw new Error(`Database path validation failed: ${error}`);
  }
  
  return dbPath;
}

function getDatabase(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(getDbPath());
    dbInstance.pragma('journal_mode = WAL');
    initializeSchema();
  }
  return dbInstance;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function initializeSchema(): void {
  const db = dbInstance!;
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    );
    
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);
}

interface DatabaseUserRow {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
  is_active: number;
}

function mapRowToUser(row: DatabaseUserRow): User {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isActive: row.is_active === 1,
  };
}

async function executeDatabaseUser(args: Record<string, unknown>): Promise<string> {
  const typedArgs = args as unknown as DatabaseUserArgs;
  const { operation, id, email, firstName, lastName, password, isActive } = typedArgs;

  // Validate operation
  if (!operation || !['get_user_by_id', 'get_user_by_email', 'get_all_users', 'create_user', 'update_user', 'delete_user'].includes(operation)) {
    throw new Error('operation is required and must be one of: get_user_by_id, get_user_by_email, get_all_users, create_user, update_user, delete_user');
  }

    try {
      const db = getDatabase();
      let result: unknown;

    switch (operation) {
      case 'get_user_by_id':
        if (!id || typeof id !== 'string') {
          throw new Error('id is required and must be a string for get_user_by_id operation');
        }
        result = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DatabaseUserRow | undefined;
        if (!result) {
          return `User with id '${id}' not found`;
        }
        return JSON.stringify(mapRowToUser(result as DatabaseUserRow), null, 2);
      
      case 'get_user_by_email':
        if (!email || typeof email !== 'string') {
          throw new Error('email is required and must be a string for get_user_by_email operation');
        }
        result = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as DatabaseUserRow | undefined;
        if (!result) {
          return `User with email '${email}' not found`;
        }
        return JSON.stringify(mapRowToUser(result as DatabaseUserRow), null, 2);
      
      case 'get_all_users':
        const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
          const users = (rows as unknown[]).map(row => mapRowToUser(row as DatabaseUserRow));
        return JSON.stringify(users, null, 2);

      case 'create_user':
        if (!firstName || typeof firstName !== 'string') {
          throw new Error('firstName is required and must be a string for create_user operation');
        }
        if (!lastName || typeof lastName !== 'string') {
          throw new Error('lastName is required and must be a string for create_user operation');
        }
        if (!email || typeof email !== 'string') {
          throw new Error('email is required and must be a string for create_user operation');
        }
        if (!password || typeof password !== 'string') {
          throw new Error('password is required and must be a string for create_user operation');
        }

        const userId = uuidv4();
        const now = new Date().toISOString();
        const fullName = `${firstName} ${lastName}`;
        const passwordHash = hashPassword(password);

        try {
          const stmt = db.prepare(`
            INSERT INTO users (id, first_name, last_name, full_name, email, password_hash, created_at, updated_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
           
          stmt.run(userId, firstName, lastName, fullName, email, passwordHash, now, now, 1);
           
          const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
          return JSON.stringify(mapRowToUser(newUser as DatabaseUserRow), null, 2);
        } catch (error) {
          if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
            throw new Error(`User with email '${email}' already exists`);
          }
          throw error;
        }
 
      case 'update_user':
        if (!id || typeof id !== 'string') {
          throw new Error('id is required and must be a string for update_user operation');
        }

        const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!existingUser) {
          throw new Error(`User with id '${id}' not found`);
        }

        const updates: string[] = [];
        const values: (string | number)[] = [];

        if (firstName !== undefined) {
          if (typeof firstName !== 'string') {
            throw new Error('firstName must be a string');
          }
          updates.push('first_name = ?');
          values.push(firstName);
        }

        if (lastName !== undefined) {
          if (typeof lastName !== 'string') {
            throw new Error('lastName must be a string');
          }
          updates.push('last_name = ?');
          values.push(lastName);
        }

        if (firstName !== undefined || lastName !== undefined) {
          const existingRow = existingUser as DatabaseUserRow;
          const newFirst = firstName ?? existingRow.first_name;
          const newLast = lastName ?? existingRow.last_name;
          updates.push('full_name = ?');
          values.push(`${newFirst} ${newLast}`);
        }

        if (email !== undefined) {
          if (typeof email !== 'string') {
            throw new Error('email must be a string');
          }
          updates.push('email = ?');
          values.push(email);
        }

        if (password !== undefined) {
          if (typeof password !== 'string') {
            throw new Error('password must be a string');
          }
          updates.push('password_hash = ?');
          values.push(hashPassword(password));
        }

        if (isActive !== undefined) {
          if (typeof isActive !== 'boolean') {
            throw new Error('isActive must be a boolean');
          }
          updates.push('is_active = ?');
          values.push(isActive ? 1 : 0);
        }

        if (updates.length === 0) {
          throw new Error('At least one field to update must be provided');
        }

        updates.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(id);

        try {
          const updateStmt = db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`);
          updateStmt.run(...values);
           
          const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DatabaseUserRow;
          return JSON.stringify(mapRowToUser(updatedUser), null, 2);
        } catch (error) {
          if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
            throw new Error(`User with email '${email}' already exists`);
          }
          throw error;
        }

      case 'delete_user':
        if (!id || typeof id !== 'string') {
          throw new Error('id is required and must be a string for delete_user operation');
        }

        const deleteResult = db.prepare('DELETE FROM users WHERE id = ?').run(id);
        if (deleteResult.changes === 0) {
          return `User with id '${id}' not found`;
        }
        return `User with id '${id}' deleted successfully`;

      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`database_user operation failed: ${error.message}`);
    }
    throw error;
  }
}

export function resetDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export const databaseUserTool: ToolDefinition = {
  name: 'database_user',
  description: 'Connect to a SQLite database and perform user information operations (create, read, update, delete users)',
  parameters: z.object({
    operation: z.enum(['get_user_by_id', 'get_user_by_email', 'get_all_users', 'create_user', 'update_user', 'delete_user']).describe('The operation to perform on user data'),
    id: z.string().optional().describe('User ID (required for get_user_by_id, update_user, delete_user operations)'),
    email: z.string().optional().describe('User email (required for get_user_by_email, create_user operations)'),
    firstName: z.string().optional().describe('User first name (required for create_user, optional for update_user)'),
    lastName: z.string().optional().describe('User last name (required for create_user, optional for update_user)'),
    password: z.string().optional().describe('User password (required for create_user, optional for update_user)'),
    isActive: z.boolean().optional().describe('User active status (optional for update_user)'),
  }),
  execute: executeDatabaseUser,
};
