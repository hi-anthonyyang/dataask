# TLS/HTTPS Security Implementation

## Overview

This document describes the TLS/HTTPS security improvements implemented in DataAsk to protect data in transit and at rest.

## Database Connection Security

### SQLite Security

**SQLite database security measures:**

- **File Permissions**: Database files should have restricted permissions (600)
- **Directory Security**: Store database files in a secure directory
- **Encryption**: Consider using SQLite encryption extensions for sensitive data

### Environment Variables

```bash
# Enable SSL in development
DB_SSL_ENABLED=false

# Validate SSL certificates (production default: true)
DB_SSL_REJECT_UNAUTHORIZED=true

# SSL Certificate files
DB_SSL_CA=/path/to/ca-certificate.crt
DB_SSL_CERT=/path/to/client-certificate.crt
DB_SSL_KEY=/path/to/client-private.key
```

## Frontend Data Encryption

### localStorage Security

**Enhanced encryption for sensitive data:**

- **Database passwords**: AES encrypted (existing)
- **Connection details**: Host, username, database names now encrypted
- **Encryption key**: Environment-based key derivation (improved security)

### Key Management

```bash
# Set custom encryption key (32+ characters recommended)
DATAASK_ENCRYPTION_KEY=your-secure-32-character-key-here!!
```

## External API Security

### OpenAI API

✅ **Already Secure**: Uses official OpenAI SDK with HTTPS by default

### Frontend-Backend Communication

✅ **Production Ready**: Inherits HTTPS from hosting environment

## Security Benefits

1. **Database Communications**: Encrypted credentials and query data
2. **localStorage Protection**: Sensitive connection details encrypted
3. **Man-in-the-Middle Prevention**: SSL/TLS prevents traffic interception
4. **Certificate Validation**: Production environments validate SSL certificates
5. **Key Security**: Environment-based encryption keys (no hardcoded secrets)

## Migration Notes

- **Backward Compatible**: Existing connections will be automatically migrated
- **Graceful Fallback**: Decryption failures fall back to plaintext for migration
- **Export Security**: Sensitive data excluded from connection exports

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure SSL certificates for databases
3. Set strong `DATAASK_ENCRYPTION_KEY`
4. Ensure HTTPS is enabled on web server
5. Verify database SSL connections are working

## Development Setup

For development with SSL:

```bash
# Enable SSL for testing
DB_SSL_ENABLED=true
DB_SSL_REJECT_UNAUTHORIZED=false  # Allow self-signed certs
```

## Per-Connection SSL Configuration

In addition to global SSL settings, DataAsk now supports per-connection SSL configuration through the connection modal:

### SSL Configuration Options
- **SSL Mode**: Choose from disable, allow, prefer, or require
- **Custom Certificates**: Specify CA certificate, client certificate, and private key paths per connection
- **Certificate Validation**: Control whether to reject unauthorized certificates per connection

### Benefits
- **Flexibility**: Different SSL settings for different database servers
- **Security**: Granular control over SSL behavior per connection
- **Compatibility**: Support for various SSL certificate setups across different environments

This allows you to have some connections with strict SSL requirements while others use more relaxed settings, all configured through the intuitive connection modal interface.