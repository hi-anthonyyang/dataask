import { Pool } from 'pg';
import crypto from 'crypto';
import { User, AuthService } from './auth';
import { logger } from './logger';

export interface UserConnection {
  id: string;
  user_id: string;
  name: string;
  type: 'sqlite';
  config: {
    filename?: string;
  };
  created_at: Date;
  updated_at: Date;
  last_used?: Date;
}

export interface CreateUserData {
  email: string;
  password: string;
}

export interface CreateConnectionData {
  name: string;
  type: 'sqlite';
  config: {
    filename?: string;
  };
}

export class UserService {
  private pool: Pool;
  private encryptionKey: string;

  constructor(pool: Pool) {
    this.pool = pool;
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key!!';
    
    if (this.encryptionKey.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
    }
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Create a new user
   */
  async createUser(userData: CreateUserData): Promise<User> {
    const { email, password } = userData;

    // Validate input
    if (!AuthService.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    const passwordValidation = AuthService.isValidPassword(password);
    if (!passwordValidation.valid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    // Check if user already exists
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const passwordHash = await AuthService.hashPassword(password);

    // Create user
    const result = await this.pool.query(
      `INSERT INTO users (email, password_hash) 
       VALUES ($1, $2) 
       RETURNING id, email, created_at, updated_at, email_verified`,
      [email, passwordHash]
    );

    const user = result.rows[0];
    logger.info(`User created: ${email}`);

    return {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      updated_at: user.updated_at,
      email_verified: user.email_verified
    };
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT id, email, created_at, updated_at, last_login, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT id, email, created_at, updated_at, last_login, email_verified FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Authenticate user with email and password
   */
  async authenticateUser(email: string, password: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT id, email, password_hash, created_at, updated_at, last_login, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const isValidPassword = await AuthService.verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      return null;
    }

    // Update last login
    await this.pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    return {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: new Date(),
      email_verified: user.email_verified
    };
  }

  /**
   * Create a user connection
   */
  async createConnection(userId: string, connectionData: CreateConnectionData): Promise<UserConnection> {
    const { name, type, config } = connectionData;

    // Encrypt the configuration
    const encryptedConfig = this.encrypt(JSON.stringify(config));

    const result = await this.pool.query(
      `INSERT INTO user_connections (user_id, name, type, encrypted_config) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, user_id, name, type, created_at, updated_at`,
      [userId, name, type, encryptedConfig]
    );

    const connection = result.rows[0];
    logger.info(`Connection created: ${name} for user ${userId}`);

    return {
      id: connection.id,
      user_id: connection.user_id,
      name: connection.name,
      type: connection.type,
      config,
      created_at: connection.created_at,
      updated_at: connection.updated_at
    };
  }

  /**
   * Get user connections
   */
  async getUserConnections(userId: string): Promise<UserConnection[]> {
    const result = await this.pool.query(
      'SELECT id, user_id, name, type, encrypted_config, created_at, updated_at, last_used FROM user_connections WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      type: row.type,
      config: JSON.parse(this.decrypt(row.encrypted_config)),
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_used: row.last_used
    }));
  }

  /**
   * Get a specific user connection
   */
  async getUserConnection(userId: string, connectionId: string): Promise<UserConnection | null> {
    const result = await this.pool.query(
      'SELECT id, user_id, name, type, encrypted_config, created_at, updated_at, last_used FROM user_connections WHERE id = $1 AND user_id = $2',
      [connectionId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      type: row.type,
      config: JSON.parse(this.decrypt(row.encrypted_config)),
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_used: row.last_used
    };
  }

  /**
   * Update connection last used timestamp
   */
  async updateConnectionLastUsed(userId: string, connectionId: string): Promise<void> {
    await this.pool.query(
      'UPDATE user_connections SET last_used = NOW() WHERE id = $1 AND user_id = $2',
      [connectionId, userId]
    );
  }

  /**
   * Delete a user connection
   */
  async deleteConnection(userId: string, connectionId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM user_connections WHERE id = $1 AND user_id = $2',
      [connectionId, userId]
    );

    return (result.rowCount || 0) > 0;
  }

  /**
   * Update a user connection
   */
  async updateConnection(userId: string, connectionId: string, connectionData: CreateConnectionData): Promise<UserConnection | null> {
    const { name, type, config } = connectionData;

    // Encrypt the configuration
    const encryptedConfig = this.encrypt(JSON.stringify(config));

    const result = await this.pool.query(
      `UPDATE user_connections 
       SET name = $1, type = $2, encrypted_config = $3, updated_at = NOW() 
       WHERE id = $4 AND user_id = $5 
       RETURNING id, user_id, name, type, created_at, updated_at`,
      [name, type, encryptedConfig, connectionId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const connection = result.rows[0];
    logger.info(`Connection updated: ${name} for user ${userId}`);

    return {
      id: connection.id,
      user_id: connection.user_id,
      name: connection.name,
      type: connection.type,
      config,
      created_at: connection.created_at,
      updated_at: connection.updated_at
    };
  }
}