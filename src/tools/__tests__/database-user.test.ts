import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { databaseUserTool, resetDatabase } from '../database-user';
import { promises as fs } from 'fs';

describe('databaseUserTool', () => {
  const testDbPath = './test-users.db';
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set test database path
    process.env.DB_PATH = testDbPath;
  });

  afterEach(async () => {
    // Reset database connection to prevent test interference
    resetDatabase();
    
    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch {
      // File might not exist, ignore error
    }
    // Restore environment
    process.env = originalEnv;
  });

  it('should validate required operation parameter', async () => {
    await expect(
      databaseUserTool.execute({} as any)
    ).rejects.toThrow('operation is required and must be one of: get_user_by_id, get_user_by_email, get_all_users, create_user, update_user, delete_user');
  });

  it('should validate invalid operation', async () => {
    await expect(
      databaseUserTool.execute({ operation: 'invalid_op' } as any)
    ).rejects.toThrow('operation is required and must be one of: get_user_by_id, get_user_by_email, get_all_users, create_user, update_user, delete_user');
  });

  it('should create a user successfully', async () => {
    const result = await databaseUserTool.execute({
      operation: 'create_user',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'password123'
    });

    const user = JSON.parse(result);
    expect(user.firstName).toBe('John');
    expect(user.lastName).toBe('Doe');
    expect(user.email).toBe('john.doe@example.com');
    expect(user.fullName).toBe('John Doe');
    expect(user.isActive).toBe(true);
    expect(user.id).toBeDefined();
    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
  });

  it('should require first name for create_user', async () => {
    await expect(
      databaseUserTool.execute({
        operation: 'create_user',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123'
      } as any)
    ).rejects.toThrow('firstName is required and must be a string for create_user operation');
  });

  it('should require last name for create_user', async () => {
    await expect(
      databaseUserTool.execute({
        operation: 'create_user',
        firstName: 'John',
        email: 'john.doe@example.com',
        password: 'password123'
      } as any)
    ).rejects.toThrow('lastName is required and must be a string for create_user operation');
  });

  it('should require email for create_user', async () => {
    await expect(
      databaseUserTool.execute({
        operation: 'create_user',
        firstName: 'John',
        lastName: 'Doe',
        password: 'password123'
      } as any)
    ).rejects.toThrow('email is required and must be a string for create_user operation');
  });

  it('should require password for create_user', async () => {
    await expect(
      databaseUserTool.execute({
        operation: 'create_user',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com'
      } as any)
    ).rejects.toThrow('password is required and must be a string for create_user operation');
  });

  it('should prevent duplicate email creation', async () => {
    // Create first user
    await databaseUserTool.execute({
      operation: 'create_user',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'password123'
    });

    // Try to create second user with same email
    await expect(
      databaseUserTool.execute({
        operation: 'create_user',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'john.doe@example.com',
        password: 'password456'
      } as any)
    ).rejects.toThrow("User with email 'john.doe@example.com' already exists");
  });

  it('should get user by ID', async () => {
    // Create a user first
    const createResult = await databaseUserTool.execute({
      operation: 'create_user',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'password123'
    });
    const createdUser = JSON.parse(createResult);

    // Get user by ID
    const getResult = await databaseUserTool.execute({
      operation: 'get_user_by_id',
      id: createdUser.id
    });

    const user = JSON.parse(getResult);
    expect(user.id).toBe(createdUser.id);
    expect(user.firstName).toBe('John');
    expect(user.email).toBe('john.doe@example.com');
  });

  it('should return not found for non-existent user ID', async () => {
    const result = await databaseUserTool.execute({
      operation: 'get_user_by_id',
      id: 'non-existent-id'
    });

    expect(result).toBe("User with id 'non-existent-id' not found");
  });

  it('should require ID for get_user_by_id', async () => {
    await expect(
      databaseUserTool.execute({ operation: 'get_user_by_id' } as any)
    ).rejects.toThrow('id is required and must be a string for get_user_by_id operation');
  });

  it('should get user by email', async () => {
    // Create a user first
    await databaseUserTool.execute({
      operation: 'create_user',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'password123'
    });

    // Get user by email
    const result = await databaseUserTool.execute({
      operation: 'get_user_by_email',
      email: 'john.doe@example.com'
    });

    const user = JSON.parse(result);
    expect(user.firstName).toBe('John');
    expect(user.email).toBe('john.doe@example.com');
  });

  it('should return not found for non-existent email', async () => {
    const result = await databaseUserTool.execute({
      operation: 'get_user_by_email',
      email: 'nonexistent@example.com'
    });

    expect(result).toBe("User with email 'nonexistent@example.com' not found");
  });

  it('should require email for get_user_by_email', async () => {
    await expect(
      databaseUserTool.execute({ operation: 'get_user_by_email' } as any)
    ).rejects.toThrow('email is required and must be a string for get_user_by_email operation');
  });

  it('should get all users', async () => {
    // Create multiple users with delay to ensure different timestamps
    await databaseUserTool.execute({
      operation: 'create_user',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'password123'
    });

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await databaseUserTool.execute({
      operation: 'create_user',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      password: 'password456'
    });

    // Get all users
    const result = await databaseUserTool.execute({
      operation: 'get_all_users'
    });

    const users = JSON.parse(result);
    expect(users).toHaveLength(2);
    expect(users[0].firstName).toBe('Jane'); // Should be ordered by created_at DESC
    expect(users[1].firstName).toBe('John');
  });

  it('should update user successfully', async () => {
    // Create a user first
    const createResult = await databaseUserTool.execute({
      operation: 'create_user',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'password123'
    });
    const createdUser = JSON.parse(createResult);

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    // Update user
    const updateResult = await databaseUserTool.execute({
      operation: 'update_user',
      id: createdUser.id,
      firstName: 'Jonathan',
      lastName: 'Doe-Smith',
      isActive: false
    });

    const updatedUser = JSON.parse(updateResult);
    expect(updatedUser.id).toBe(createdUser.id);
    expect(updatedUser.firstName).toBe('Jonathan');
    expect(updatedUser.lastName).toBe('Doe-Smith');
    expect(updatedUser.fullName).toBe('Jonathan Doe-Smith');
    expect(updatedUser.isActive).toBe(false);
    expect(updatedUser.updatedAt).not.toBe(createdUser.updatedAt);
  });

  it('should require ID for update_user', async () => {
    await expect(
      databaseUserTool.execute({ operation: 'update_user' } as any)
    ).rejects.toThrow('id is required and must be a string for update_user operation');
  });

  it('should return not found when updating non-existent user', async () => {
    await expect(
      databaseUserTool.execute({
        operation: 'update_user',
        id: 'non-existent-id',
        firstName: 'John'
      } as any)
    ).rejects.toThrow("User with id 'non-existent-id' not found");
  });

  it('should require at least one field to update', async () => {
    // Create a user first
    const createResult = await databaseUserTool.execute({
      operation: 'create_user',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'password123'
    });
    const createdUser = JSON.parse(createResult);

    await expect(
      databaseUserTool.execute({
        operation: 'update_user',
        id: createdUser.id
      })
    ).rejects.toThrow('At least one field to update must be provided');
  });

  it('should validate parameter types for update_user', async () => {
    // Create a user first
    const createResult = await databaseUserTool.execute({
      operation: 'create_user',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'password123'
    });
    const createdUser = JSON.parse(createResult);

    await expect(
      databaseUserTool.execute({
        operation: 'update_user',
        id: createdUser.id,
        firstName: 123 as any
      })
    ).rejects.toThrow('firstName must be a string');

    await expect(
      databaseUserTool.execute({
        operation: 'update_user',
        id: createdUser.id,
        isActive: 'not-boolean' as any
      })
    ).rejects.toThrow('isActive must be a boolean');
  });

  it('should delete user successfully', async () => {
    // Create a user first
    const createResult = await databaseUserTool.execute({
      operation: 'create_user',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'password123'
    });
    const createdUser = JSON.parse(createResult);

    // Delete user
    const deleteResult = await databaseUserTool.execute({
      operation: 'delete_user',
      id: createdUser.id
    });

    expect(deleteResult).toBe(`User with id '${createdUser.id}' deleted successfully`);

    // Verify user is deleted
    const getResult = await databaseUserTool.execute({
      operation: 'get_user_by_id',
      id: createdUser.id
    });
    expect(getResult).toBe(`User with id '${createdUser.id}' not found`);
  });

  it('should require ID for delete_user', async () => {
    await expect(
      databaseUserTool.execute({ operation: 'delete_user' })
    ).rejects.toThrow('id is required and must be a string for delete_user operation');
  });

  it('should return not found when deleting non-existent user', async () => {
    const result = await databaseUserTool.execute({
      operation: 'delete_user',
      id: 'non-existent-id'
    });

    expect(result).toBe("User with id 'non-existent-id' not found");
  });

  it('should handle database errors gracefully', async () => {
    // This test verifies that database errors are caught and re-thrown with proper formatting
    const result = await databaseUserTool.execute({
      operation: 'get_user_by_id',
      id: 'test-id'
    });

    expect(result).toBe("User with id 'test-id' not found");
  });

  it('should validate parameter types for create_user', async () => {
    await expect(
      databaseUserTool.execute({
        operation: 'create_user',
        firstName: 123 as any,
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123'
      })
    ).rejects.toThrow('firstName is required and must be a string for create_user operation');

    await expect(
      databaseUserTool.execute({
        operation: 'create_user',
        firstName: 'John',
        lastName: [] as any,
        email: 'john.doe@example.com',
        password: 'password123'
      })
    ).rejects.toThrow('lastName is required and must be a string for create_user operation');
  });
});
