# Rate Limiting Implementation

## Overview

This implementation provides comprehensive rate limiting protection for the DataAsk API with different limits for different endpoint types to protect against abuse while maintaining excellent user experience.

## Features

- **Granular Rate Limiting**: Different limits for AI, database, and general endpoints
- **Environment-based Configuration**: Easy tuning without code changes
- **Comprehensive Monitoring**: Detailed logging of rate limit violations
- **Health Endpoint**: Real-time configuration visibility
- **Production Ready**: Immediately deployable with backward compatibility

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Rate Limiting Configuration
RATE_LIMIT_AI=20        # AI endpoints (LLM-related)
RATE_LIMIT_DB=60        # Database endpoints  
RATE_LIMIT_GENERAL=100  # General endpoints (health, root, etc.)
```

### Default Limits

- **AI Endpoints** (`/api/llm/*`): 20 requests per 15 minutes
- **Database Endpoints** (`/api/db/*`): 60 requests per 15 minutes
- **File Upload Endpoints** (`/api/files/*`): 60 requests per 15 minutes (same as database)
- **General Endpoints** (health, root, etc.): 100 requests per 15 minutes

## Deployment

### 1. Copy Environment Config
```bash
cp .env.example .env
# Edit .env with your actual values
```

### 2. Restart Your Server
```bash
npm run dev # or npm start for production
```

### 3. Verify It's Working
```bash
curl http://localhost:3001/health
# Should show rate limit configuration
```

## Monitoring

### Health Endpoint

Check current configuration:
```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development",
  "rateLimits": {
    "ai": "20 requests per 15 minutes",
    "database": "60 requests per 15 minutes", 
    "general": "100 requests per 15 minutes"
  }
}
```

### Rate Limit Violations

Violations are logged with detailed information:
```json
{
  "level": "warn",
  "message": "Rate limit exceeded",
  "ip": "192.168.1.100",
  "path": "/api/llm/nl-to-sql",
  "limit": 20,
  "windowMinutes": 15,
  "endpointType": "AI"
}
```

## Easy Tuning

To adjust limits without code changes:

```bash
# In your .env file
RATE_LIMIT_AI=10      # Stricter AI limits
RATE_LIMIT_DB=30      # Conservative DB limits
RATE_LIMIT_GENERAL=50 # Tighter general limits
```

## API Protection

Your API is now protected against expensive abuse while maintaining excellent user experience for legitimate usage! 🛡️💰

The implementation is production-ready and will immediately start protecting your OpenAI costs while maintaining backward compatibility with all existing functionality.

## Implementation Details

### Rate Limiter Types

1. **AI Rate Limiter**: Applied to `/api/llm/*` endpoints
   - Protects against OpenAI API abuse
   - Stricter limits due to cost implications

2. **Database Rate Limiter**: Applied to `/api/db/*` endpoints
   - Protects database resources
   - Moderate limits for data operations

3. **File Upload Rate Limiter**: Applied to `/api/files/*` endpoints
   - Protects against file upload abuse
   - Same limits as database operations (file imports create database tables)

4. **General Rate Limiter**: Applied to all other endpoints
   - Health checks, root endpoint, etc.
   - More lenient limits for basic operations

### Key Features

- **IP-based Limiting**: Uses client IP addresses for rate limiting
- **15-minute Windows**: All limits reset every 15 minutes
- **Detailed Logging**: Comprehensive violation tracking
- **Graceful Responses**: Clear error messages with retry information
- **Environment Flexibility**: Easy configuration via environment variables

## Security Benefits

- **Cost Protection**: Prevents OpenAI API abuse
- **Resource Protection**: Guards against database overload
- **DoS Protection**: Mitigates denial-of-service attacks
- **Monitoring**: Comprehensive logging for security analysis 