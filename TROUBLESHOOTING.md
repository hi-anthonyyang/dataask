# DataAsk Troubleshooting Guide

## Common Issues

### Database Connection Issues

#### Connection Timeouts
**Symptoms**: Connection modal shows spinning wheel indefinitely
**Solutions**:
- Check database server is running and accessible
- Verify host, port, and credentials are correct
- Check firewall settings and network connectivity
- Try increasing connection timeout in Advanced Settings

#### SSL/TLS Connection Errors
**Symptoms**: "SSL connection failed" or certificate errors
**Solutions**:
- Set SSL mode to "prefer" or "allow" for development
- Verify SSL certificates are valid and accessible
- Check `DB_SSL_REJECT_UNAUTHORIZED` setting

### File Import Issues

#### File Upload Fails
**Symptoms**: "Upload failed" error or file not accepted
**Solutions**:
- Verify file format is CSV, XLS, or XLSX
- Check file size is under 50MB limit
- Ensure file has proper headers and data rows
- Check server disk space in `uploads/` directory

#### Column Type Detection Issues
**Symptoms**: Wrong column types detected or import errors
**Solutions**:
- Review and adjust column types in the Configure step
- Ensure data is properly formatted (dates, numbers)
- Check for empty or null values in data
- Use Text type for mixed data columns

#### Import Creates Empty Table
**Symptoms**: Import succeeds but table has no data
**Solutions**:
- Verify CSV has proper header row
- Check for encoding issues (use UTF-8)
- Ensure data rows exist after header
- Review column mapping in preview step

### Performance Issues

#### Slow Query Execution
**Solutions**:
- Check database connection pool settings
- Verify database server performance
- Review query complexity and table sizes
- Check network latency to database

#### High Memory Usage
**Solutions**:
- Monitor file upload sizes and frequency
- Clean up temporary files in `uploads/` directory
- Check SQLite database sizes in `data/` directory
- Restart application if memory leaks suspected

### Authentication Issues

#### Login/Registration Fails
**Solutions**:
- Check PostgreSQL database is running
- Verify JWT secrets are configured
- Check CORS settings for frontend domain
- Review server logs for detailed errors

## Getting Help

### Log Files
- Backend logs: Check console output or PM2 logs
- Frontend logs: Check browser developer console
- Database logs: Check PostgreSQL/MySQL server logs

### Environment Check
```bash
# Verify environment variables
cat .env | grep -E "(JWT_SECRET|POSTGRES_|DB_)"

# Check file permissions
ls -la uploads/ data/

# Test database connectivity
curl -X GET http://localhost:3001/health
```

### Common Log Messages
- `"Connection test failed"`: Database connectivity issue
- `"File parsing failed"`: Invalid file format or corruption
- `"Rate limit exceeded"`: Too many requests, wait and retry
- `"JWT token expired"`: Authentication session expired, login again
