# 🚀 DataAsk Authentication System - Deployment Guide

This guide will walk you through deploying the secure authentication system from development to production.

## 📋 Prerequisites

- Node.js 18+ installed
- PostgreSQL 13+ database
- Git repository access
- Domain name (for production)

## 🔧 Development Setup

### 1. Environment Configuration

Create your environment file:
```bash
cp env.example .env
```

Update `.env` with your configuration:
```bash
# Server Configuration
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Database Configuration (Development)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=dataask_dev
POSTGRES_USER=dataask_user
POSTGRES_PASSWORD=your_secure_dev_password

# Security Keys (CHANGE THESE!)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
JWT_REFRESH_SECRET=your-different-refresh-secret-minimum-32-characters
ENCRYPTION_KEY=your-32-character-encryption-key-here!!

# Database SSL (Development)
DB_SSL_ENABLED=false
DB_SSL_REJECT_UNAUTHORIZED=false

# Frontend Encryption (Copy to frontend .env)
VITE_DATAASK_ENCRYPTION_KEY=your-32-character-encryption-key-here!!

# OpenAI API (if using LLM features)
OPENAI_API_KEY=your_openai_api_key_here

# Logging
LOG_LEVEL=info
```

### 2. Database Setup

#### Option A: Using Docker (Recommended for Development)
```bash
# Start PostgreSQL with Docker
npm run docker:up

# Wait for database to be ready
sleep 10

# Run migrations
cd apps/backend
npm run migrate
```

#### Option B: Local PostgreSQL Installation
```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create user and database
sudo -u postgres psql
CREATE USER dataask_user WITH PASSWORD 'your_secure_dev_password';
CREATE DATABASE dataask_dev OWNER dataask_user;
GRANT ALL PRIVILEGES ON DATABASE dataask_dev TO dataask_user;
\q

# Run migrations
cd apps/backend
npm run migrate
```

### 3. Install Dependencies

```bash
# Install all dependencies
npm install

# Install backend dependencies
cd apps/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 4. Start Development Servers

```bash
# From project root
npm run dev

# Or start individually:
# Backend: cd apps/backend && npm run dev
# Frontend: cd apps/frontend && npm run dev
```

## 🧪 Testing the Authentication System

### 1. Backend API Testing

Test the authentication endpoints:

```bash
# Health check
curl http://localhost:3001/health

# Register a new user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }' \
  -c cookies.txt

# Login (should work with cookies from registration)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }' \
  -c cookies.txt

# Get current user (using cookies)
curl http://localhost:3001/api/auth/me \
  -b cookies.txt

# Create a connection
curl -X POST http://localhost:3001/api/user/connections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Database",
    "type": "postgresql",
    "config": {
      "host": "localhost",
      "port": 5432,
      "database": "testdb",
      "username": "testuser",
      "password": "testpass"
    }
  }' \
  -b cookies.txt

# List user connections
curl http://localhost:3001/api/user/connections \
  -b cookies.txt
```

### 2. Frontend Testing

1. **Open browser to http://localhost:3000**
2. **Test Registration Flow**:
   - Click "Sign In" button
   - Switch to "Create Account"
   - Enter email and strong password
   - Verify account creation and automatic login

3. **Test Login Flow**:
   - Logout and login again
   - Verify persistent session across browser refresh

4. **Test Connection Migration**:
   - Create some localStorage connections (use existing app)
   - Register/login to trigger migration modal
   - Verify connections are migrated to server

5. **Test Cross-Device Sync**:
   - Login from different browser/device
   - Verify connections are synchronized

## 🔒 Security Checklist

Before going to production, verify:

- [ ] **Strong Secrets**: JWT and encryption keys are cryptographically secure
- [ ] **Environment Variables**: All secrets in environment, not code
- [ ] **Database Security**: Strong passwords, SSL enabled
- [ ] **HTTPS**: SSL certificates configured
- [ ] **CORS**: Origins properly restricted
- [ ] **Rate Limiting**: Enabled and configured
- [ ] **Input Validation**: All endpoints validate input
- [ ] **Error Handling**: No sensitive data in error messages
- [ ] **Logging**: Security events logged, no sensitive data logged

## 🌐 Production Deployment

### 1. Production Environment Setup

Update your production `.env`:
```bash
# Server Configuration
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://yourdomain.com

# Database Configuration (Production)
POSTGRES_HOST=your-production-db-host
POSTGRES_PORT=5432
POSTGRES_DB=dataask_prod
POSTGRES_USER=dataask_prod_user
POSTGRES_PASSWORD=very_secure_production_password

# Security Keys (Generate new ones!)
JWT_SECRET=generate-new-cryptographically-secure-secret-64-chars-minimum
JWT_REFRESH_SECRET=different-secure-refresh-secret-64-chars-minimum
ENCRYPTION_KEY=generate-new-32-char-encryption-key

# Database SSL (Production)
DB_SSL_ENABLED=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_SSL_CA=/path/to/ca-certificate.crt
DB_SSL_CERT=/path/to/client-certificate.crt
DB_SSL_KEY=/path/to/client-key.key

# Logging
LOG_LEVEL=warn
```

### 2. Database Migration (Production)

```bash
# Backup existing database first!
pg_dump dataask_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
cd apps/backend
NODE_ENV=production npm run migrate
```

### 3. Build and Deploy

```bash
# Build both frontend and backend
npm run build

# Deploy backend
cd apps/backend
npm run start

# Deploy frontend (serve dist/ folder with nginx/apache)
cd apps/frontend
# Copy dist/ contents to web server
```

### 4. Production Health Checks

```bash
# Test production endpoints
curl https://yourdomain.com/api/health
curl https://yourdomain.com/api/auth/health
curl https://yourdomain.com/health/db
```

## 🔧 Monitoring & Maintenance

### Log Monitoring

Monitor these log patterns:
```bash
# Authentication events
grep "User registered\|User logged in\|Authentication failed" /var/log/dataask/app.log

# Security events
grep "Invalid token\|Rate limit exceeded\|Validation failed" /var/log/dataask/app.log

# Database events
grep "Migration\|Database" /var/log/dataask/app.log
```

### Performance Monitoring

Key metrics to monitor:
- Authentication endpoint response times
- Database connection pool usage
- JWT token validation performance
- Encryption/decryption operations
- Memory usage for user sessions

### Backup Strategy

```bash
# Daily database backup
pg_dump dataask_prod > daily_backup_$(date +%Y%m%d).sql

# Weekly full backup with user data
pg_dump -Fc dataask_prod > weekly_backup_$(date +%Y%m%d).dump
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Fails**
   ```bash
   # Check database status
   sudo systemctl status postgresql
   
   # Check connection
   psql -h localhost -U dataask_user -d dataask_dev
   ```

2. **JWT Token Issues**
   ```bash
   # Verify JWT secret is set
   echo $JWT_SECRET
   
   # Check token in browser developer tools
   # Application > Cookies > accessToken
   ```

3. **Encryption Errors**
   ```bash
   # Verify encryption key length
   echo $ENCRYPTION_KEY | wc -c  # Should be 33 (32 chars + newline)
   ```

4. **CORS Issues**
   ```bash
   # Check CORS origin setting
   echo $CORS_ORIGIN
   
   # Verify in browser network tab
   ```

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

## 🔄 Migration from Existing System

If you have existing users:

1. **Gradual Migration**: Keep both systems running
2. **User Choice**: Let users opt-in to new authentication
3. **Data Preservation**: Maintain localStorage as backup
4. **Rollback Plan**: Ability to disable authentication

## 📈 Scaling Considerations

For high-traffic deployments:

1. **Database**: Use connection pooling, read replicas
2. **Sessions**: Consider Redis for session storage
3. **Load Balancing**: Multiple backend instances
4. **CDN**: Serve frontend assets from CDN
5. **Monitoring**: APM tools for performance tracking

## 🎯 Success Metrics

Track these metrics to measure success:

- **User Adoption**: Registration and login rates
- **Migration Success**: localStorage → server migration completion
- **Security**: Failed authentication attempts
- **Performance**: Authentication endpoint response times
- **User Experience**: Session duration and return rates

---

## 🎉 Congratulations!

You now have a production-ready, secure authentication system that:
- ✅ Maintains privacy-first principles
- ✅ Provides excellent user experience
- ✅ Follows security best practices
- ✅ Scales with your business growth

Your users can now enjoy cross-device synchronization while you maintain complete control over their data privacy!