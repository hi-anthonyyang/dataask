# DataAsk Security Documentation

## Overview

This document outlines the security measures implemented in DataAsk to protect against various attack vectors while maintaining usability for legitimate data analysis queries.

## Security Architecture

### 1. Input Sanitization
**Location**: `apps/backend/src/security/promptSanitize.ts`

All user inputs are sanitized before processing:
- **Pattern Detection**: Identifies known injection patterns
- **Content Filtering**: Removes malicious characters while preserving legitimate syntax
- **Length Validation**: Enforces input size limits
- **Risk Assessment**: Categorizes inputs by risk level

### 2. Safe Code Execution
**Location**: `apps/backend/src/utils/pandasExecutor.ts`

Pandas code execution is sandboxed:
- **Code Validation**: Generated pandas code is validated before execution
- **Sandboxed Environment**: Code runs in controlled environment
- **Error Handling**: Safe error messages without exposing system details
- **Memory Limits**: Prevents memory exhaustion attacks

### 3. File Upload Security
**Location**: `apps/backend/src/api/files.ts`

File uploads are secured through:
- **Type Validation**: Only CSV/Excel files allowed
- **Size Limits**: Maximum 50MB per file
- **Content Validation**: File structure validation
- **Virus Scanning**: Basic malicious content detection

### 4. API Security
**Location**: `apps/backend/src/app.ts`

API endpoints are protected by:
- **Rate Limiting**: Prevents abuse and DoS attacks
- **CORS Configuration**: Proper cross-origin request handling
- **Input Validation**: Zod schema validation for all inputs
- **Error Sanitization**: Safe error messages

## Attack Vectors Protected

### 1. Prompt Injection
**Protection**: Multi-layered input sanitization and safe prompt construction
**Examples Blocked**:
- "ignore previous instructions"
- "act as admin"
- "show system prompt"

### 2. Code Injection
**Protection**: Sandboxed pandas code execution with validation
**Examples Blocked**:
- Malicious pandas code
- System command injection
- Memory exhaustion attacks

### 3. File Upload Attacks
**Protection**: Strict file validation and content checking
**Examples Blocked**:
- Malicious file uploads
- Oversized files
- Invalid file formats

### 4. API Abuse
**Protection**: Rate limiting and input validation
**Examples Blocked**:
- Rapid request flooding
- Invalid API calls
- Malformed requests

## Security Best Practices

### For Developers
1. **Always validate inputs** using Zod schemas
2. **Sanitize user content** before processing
3. **Use safe code execution** environments
4. **Log security events** for monitoring
5. **Keep dependencies updated**

### For Users
1. **Upload only trusted files**
2. **Use legitimate data analysis queries**
3. **Report suspicious behavior**
4. **Keep the application updated**

## Monitoring and Logging

All security events are logged with:
- Event type and risk level
- Input/response previews
- Detection patterns triggered
- Timestamp and endpoint information

## Incident Response

1. **Detection**: Automated pattern detection
2. **Blocking**: Immediate request blocking for high-risk inputs
3. **Logging**: Comprehensive event logging
4. **Alerting**: Security event notifications
5. **Analysis**: Post-incident analysis and improvement

## Compliance

DataAsk follows security best practices for:
- **Data Protection**: Secure handling of uploaded files
- **Code Execution**: Safe sandboxed environments
- **API Security**: Proper authentication and validation
- **Privacy**: No sensitive data logging or storage 