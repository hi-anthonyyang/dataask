# Authentication System

DataAsk now includes a comprehensive authentication system that provides secure user management while maintaining your privacy-first approach.

## 🔐 Security Features

### Backend Security
- **JWT Authentication**: Secure access and refresh tokens with proper expiration
- **Password Hashing**: bcrypt with high salt rounds (12) for maximum security
- **AES-256-GCM Encryption**: Connection credentials encrypted at rest
- **httpOnly Cookies**: Tokens stored in secure, httpOnly cookies (XSS protection)
- **CORS Configuration**: Proper cross-origin handling with credentials
- **Input Validation**: Comprehensive validation using Zod schemas
- **SQL Injection Protection**: Parameterized queries and input sanitization

### Frontend Security
- **Automatic Token Refresh**: Seamless token renewal without user intervention
- **Secure Cookie Storage**: Authentication tokens never exposed to JavaScript
- **Input Validation**: Client-side validation with server-side enforcement
- **Password Strength Requirements**: Enforced strong password policies

## 🚀 Getting Started

### 1. Environment Setup

Copy the example environment file and configure your settings:

```bash
cp env.example .env
```

**Required Environment Variables:**
```bash
# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=dataask_dev
POSTGRES_USER=dataask_user
POSTGRES_PASSWORD=your-secure-password

# Security (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key-change-in-production
ENCRYPTION_KEY=your-32-character-encryption-key-here!!
```

### 2. Database Setup

Start the PostgreSQL database:
```bash
npm run docker:up
```

Run database migrations:
```bash
cd apps/backend
npm run migrate
```

### 3. Start the Application

```bash
# Start backend and frontend
npm run dev
```

## 📊 Data Storage Architecture

### User Data (Server-side)
- **Users Table**: Basic user information (email, password hash, timestamps)
- **User Connections**: Encrypted database connection configurations
- **Migrations**: Automatic database schema management

### Client-side Storage
- **httpOnly Cookies**: Authentication tokens (secure, not accessible via JavaScript)
- **localStorage**: UI preferences and backward compatibility (no sensitive data)

## 🔄 Migration Flow

When users first sign up, the system automatically detects existing localStorage connections and offers to migrate them:

1. **Detection**: Checks for existing localStorage connections
2. **User Choice**: Presents migration dialog with connection preview
3. **Secure Transfer**: Encrypts and stores connections on server
4. **Backup**: Maintains localStorage as backup during transition

## 🛡️ Privacy Guarantees

### What We Store
- ✅ **User email** (for login only)
- ✅ **Encrypted connection details** (AES-256-GCM)
- ✅ **Connection metadata** (names, types, usage timestamps)

### What We DON'T Store
- ❌ **Query content** (queries remain client-side)
- ❌ **Query results** (never sent to our servers)
- ❌ **Personal data** (beyond email for authentication)
- ❌ **Usage tracking** (no analytics or tracking)

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - Sign out user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user info

### User Connections
- `GET /api/user/connections` - List user's connections
- `POST /api/user/connections` - Create new connection
- `PUT /api/user/connections/:id` - Update connection
- `DELETE /api/user/connections/:id` - Delete connection
- `POST /api/user/connections/migrate` - Migrate localStorage connections

## 💻 Frontend Integration

### Authentication Service
```typescript
import { authService } from './services/auth';

// Check authentication status
const isAuthenticated = authService.isAuthenticated();

// Listen for auth state changes
const unsubscribe = authService.onAuthStateChange((user) => {
  if (user) {
    console.log('User signed in:', user.email);
  } else {
    console.log('User signed out');
  }
});

// Sign in
await authService.login({ email, password });

// Sign out
await authService.logout();
```

### User Connections Service
```typescript
import { userConnectionsService } from './services/userConnections';

// Get user's connections
const connections = await userConnectionsService.getConnections();

// Create new connection
const newConnection = await userConnectionsService.createConnection({
  name: 'My Database',
  type: 'postgresql',
  config: { host: 'localhost', database: 'mydb', ... }
});
```

## 🔒 Security Best Practices

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter  
- At least one number
- At least one special character

### Token Management
- **Access tokens**: 15-minute expiration
- **Refresh tokens**: 7-day expiration
- **Automatic renewal**: Seamless token refresh
- **Secure storage**: httpOnly cookies only

### Connection Encryption
- **AES-256-GCM**: Industry-standard encryption
- **Unique IVs**: Each connection encrypted with unique initialization vector
- **Authentication tags**: Ensures data integrity
- **Key derivation**: Proper key stretching with scrypt

## 🚨 Production Deployment

### Environment Variables
Ensure these are properly configured in production:

```bash
NODE_ENV=production
JWT_SECRET=<generate-strong-secret>
JWT_REFRESH_SECRET=<generate-different-strong-secret>
ENCRYPTION_KEY=<generate-32-char-key>
DB_SSL_ENABLED=true
DB_SSL_REJECT_UNAUTHORIZED=true
```

### Database Security
- Enable SSL/TLS for database connections
- Use strong database passwords
- Configure proper firewall rules
- Regular security updates

### HTTPS
- Always use HTTPS in production
- Secure cookie settings automatically enabled
- HSTS headers recommended

## 🛠️ Development

### Running Tests
```bash
# Backend tests
cd apps/backend
npm test

# Frontend tests  
cd apps/frontend
npm test
```

### Database Management
```bash
# Run migrations
npm run migrate

# Reset database (development only)
npm run docker:down
npm run docker:up
npm run migrate
```

## 📈 Monitoring

### Health Checks
- `GET /health` - General application health
- `GET /health/db` - Database connectivity
- `GET /api/auth/health` - Authentication service status

### Logging
- Structured logging with Winston
- Security events logged
- Error tracking and monitoring
- No sensitive data in logs

## 🤝 Backward Compatibility

The authentication system is designed to be fully backward compatible:

- **Unauthenticated users**: Continue using localStorage connections
- **Gradual migration**: Users can choose when to create accounts
- **Fallback support**: Always falls back to localStorage if server unavailable
- **No breaking changes**: Existing functionality preserved

## 🔄 Migration from localStorage

Users with existing localStorage connections will see a migration prompt after signing up:

1. **Automatic detection** of existing connections
2. **Preview interface** showing what will be migrated
3. **Selective migration** - users choose which connections to import
4. **Error handling** - clear feedback on any migration issues
5. **Backup preservation** - localStorage data kept as backup

This ensures a smooth transition while maintaining user control over their data.