# SQLite + JWT Authentication Implementation Plan

## Overview
Replace PostgreSQL-based authentication with a lightweight SQLite + JWT solution.

## Architecture

### 1. Database Schema (SQLite)
```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens (optional, for enhanced security)
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Audit log (optional)
CREATE TABLE auth_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

### 2. Required Dependencies
```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.5",
    "@types/bcrypt": "^5.0.2"
  }
}
```

### 3. Service Structure
```typescript
// apps/backend/src/services/authService.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { DatabaseManager } from '../utils/database';

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class AuthService {
  private static instance: AuthService;
  private dbManager: DatabaseManager;
  
  private constructor() {
    this.dbManager = DatabaseManager.getInstance();
  }
  
  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }
  
  async initialize(): Promise<void> {
    // Create auth database and tables
    await this.createAuthTables();
  }
  
  private async createAuthTables(): Promise<void> {
    // Implementation here
  }
  
  async register(email: string, password: string, name?: string): Promise<UserPayload> {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Insert user into SQLite
    // Return user payload
  }
  
  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken?: string }> {
    // Verify user exists and password matches
    // Generate JWT tokens
    // Log authentication event
    // Return tokens
  }
  
  async verifyToken(token: string): Promise<UserPayload> {
    // Verify JWT and return payload
  }
  
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    // Verify refresh token
    // Generate new access token
  }
  
  async logout(userId: string, refreshToken?: string): Promise<void> {
    // Invalidate refresh token if using them
    // Log logout event
  }
}
```

### 4. Middleware Structure
```typescript
// apps/backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    
    const authService = AuthService.getInstance();
    const user = await authService.verifyToken(token);
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
};
```

### 5. API Routes
```typescript
// apps/backend/src/api/auth.ts
import { Router } from 'express';
import { AuthService } from '../services/authService';
import { authenticate } from '../middleware/auth';

const router = Router();
const authService = AuthService.getInstance();

// Public routes
router.post('/register', async (req, res) => {
  // Validate input
  // Register user
  // Return tokens
});

router.post('/login', async (req, res) => {
  // Validate credentials
  // Return tokens
});

router.post('/refresh', async (req, res) => {
  // Refresh access token
});

// Protected routes
router.post('/logout', authenticate, async (req, res) => {
  // Logout user
});

router.get('/me', authenticate, async (req, res) => {
  // Return current user info
});

export default router;
```

### 6. Frontend Integration
```typescript
// apps/frontend/src/services/auth.ts
export class AuthService {
  private token: string | null = null;
  
  constructor() {
    this.token = localStorage.getItem('accessToken');
  }
  
  async login(email: string, password: string): Promise<void> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    this.token = data.accessToken;
    localStorage.setItem('accessToken', this.token);
    
    // Store refresh token in httpOnly cookie (more secure)
  }
  
  getAuthHeaders(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }
  
  isAuthenticated(): boolean {
    return !!this.token;
  }
  
  logout(): void {
    this.token = null;
    localStorage.removeItem('accessToken');
  }
}
```

## Security Considerations

1. **Password Security**
   - Use bcrypt with cost factor 10+
   - Implement password complexity requirements
   - Add rate limiting on login attempts

2. **Token Security**
   - Short-lived access tokens (15-30 minutes)
   - Longer-lived refresh tokens (7-30 days)
   - Store refresh tokens as httpOnly cookies
   - Implement token rotation

3. **Additional Security**
   - HTTPS only in production
   - CORS configuration
   - Helmet.js for security headers
   - Input validation and sanitization

## Migration Path

1. **Phase 1**: Implement basic auth service
2. **Phase 2**: Add middleware and protect existing routes
3. **Phase 3**: Update frontend to use new auth
4. **Phase 4**: Add refresh token support
5. **Phase 5**: Add audit logging and monitoring

## Environment Variables
```env
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
BCRYPT_ROUNDS=10
```

## Testing Strategy

1. **Unit Tests**
   - Password hashing/verification
   - Token generation/verification
   - User CRUD operations

2. **Integration Tests**
   - Full auth flow
   - Token refresh
   - Protected route access

3. **Security Tests**
   - Brute force protection
   - Token expiration
   - SQL injection prevention