import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

interface User {
  id: string;
  email: string;
  password_hash: string;
  name?: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken?: string;
}

export class AuthService {
  private static instance: AuthService;
  private db: sqlite3.Database;
  private initialized = false;

  private constructor() {
    const authDbPath = path.join(process.cwd(), 'data', 'auth.db');
    
    // Ensure data directory exists
    const dataDir = path.dirname(authDbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new sqlite3.Database(authDbPath, (err) => {
      if (err) {
        logger.error('Failed to open auth database:', err);
        throw err;
      }
      logger.info('Auth database connected');
    });
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.createAuthTables();
    this.initialized = true;
    logger.info('Auth service initialized');
  }

  private createAuthTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Users table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            logger.error('Failed to create users table:', err);
            reject(err);
            return;
          }
        });

        // Refresh tokens table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS refresh_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_hash TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) {
            logger.error('Failed to create refresh_tokens table:', err);
            reject(err);
            return;
          }
        });

        // Auth logs table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS auth_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            action TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
          )
        `, (err) => {
          if (err) {
            logger.error('Failed to create auth_logs table:', err);
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  }

  async register(email: string, password: string, name?: string): Promise<UserPayload> {
    // Validate email
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address');
    }

    // Validate password
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Check if user already exists
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`,
        [userId, email, passwordHash, name || null],
        (err) => {
          if (err) {
            logger.error('Failed to create user:', err);
            reject(new Error('Failed to create user'));
            return;
          }

          const userPayload: UserPayload = {
            id: userId,
            email,
            role: 'user'
          };

          this.logAuthAction(userId, 'register');
          resolve(userPayload);
        }
      );
    });
  }

  async login(email: string, password: string, ipAddress?: string, userAgent?: string): Promise<TokenPair> {
    const user = await this.getUserByEmail(email);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      await this.logAuthAction(user.id, 'failed_login', ipAddress, userAgent);
      throw new Error('Invalid credentials');
    }

    const userPayload: UserPayload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = this.generateAccessToken(userPayload);
    const refreshToken = await this.generateRefreshToken(user.id);

    await this.logAuthAction(user.id, 'login', ipAddress, userAgent);

    return { accessToken, refreshToken };
  }

  async verifyToken(token: string): Promise<UserPayload> {
    try {
      const payload = jwt.verify(token, this.getJwtSecret()) as UserPayload;
      return payload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    // Hash the token to compare with stored hash
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT user_id FROM refresh_tokens 
         WHERE token_hash = ? AND expires_at > datetime('now')`,
        [tokenHash],
        async (err, row: any) => {
          if (err || !row) {
            reject(new Error('Invalid or expired refresh token'));
            return;
          }

          const user = await this.getUserById(row.user_id);
          if (!user) {
            reject(new Error('User not found'));
            return;
          }

          const userPayload: UserPayload = {
            id: user.id,
            email: user.email,
            role: user.role
          };

          const accessToken = this.generateAccessToken(userPayload);
          resolve({ accessToken });
        }
      );
    });
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = await bcrypt.hash(refreshToken, 10);
      
      return new Promise((resolve, reject) => {
        this.db.run(
          `DELETE FROM refresh_tokens WHERE token_hash = ?`,
          [tokenHash],
          (err) => {
            if (err) {
              logger.error('Failed to delete refresh token:', err);
              reject(err);
              return;
            }
            this.logAuthAction(userId, 'logout');
            resolve();
          }
        );
      });
    }

    await this.logAuthAction(userId, 'logout');
  }

  private generateAccessToken(payload: UserPayload): string {
    return jwt.sign(payload, this.getJwtSecret(), {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m'
    } as jwt.SignOptions);
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = uuidv4();
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) 
         VALUES (?, ?, ?, ?)`,
        [uuidv4(), userId, tokenHash, expiresAt.toISOString()],
        (err) => {
          if (err) {
            logger.error('Failed to create refresh token:', err);
            reject(err);
            return;
          }
          resolve(token);
        }
      );
    });
  }

  private getUserByEmail(email: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM users WHERE email = ?`,
        [email],
        (err, row: User) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row || null);
        }
      );
    });
  }

  private getUserById(id: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM users WHERE id = ?`,
        [id],
        (err, row: User) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row || null);
        }
      );
    });
  }

  private async logAuthAction(
    userId: string,
    action: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO auth_logs (user_id, action, ip_address, user_agent) 
         VALUES (?, ?, ?, ?)`,
        [userId, action, ipAddress || null, userAgent || null],
        (err) => {
          if (err) {
            logger.error('Failed to log auth action:', err);
            // Don't reject, just log the error
          }
          resolve();
        }
      );
    });
  }

  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }
    return secret;
  }

  // Cleanup method
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
}