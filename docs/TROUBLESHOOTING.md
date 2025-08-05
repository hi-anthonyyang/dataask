# DataAsk Troubleshooting Guide

## Common Issues

### File Upload Issues

#### File Upload Modal Not Opening
**Symptoms**: Clicking the "+" button doesn't open the upload modal
**Solutions**:
- Ensure the frontend is properly compiled and running
- Check browser console for JavaScript errors
- Clear browser cache and reload the page
- Verify all React components are properly imported

#### File Upload Fails
**Symptoms**: "Upload failed" error or file not accepted
**Solutions**:
- Verify file format is CSV, XLS, or XLSX
- Check file size is under 50MB limit
- Ensure file has proper headers and data rows
- Check server disk space in `uploads/` directory

#### DataFrame Creation Issues
**Symptoms**: File uploads but DataFrame is not created
**Solutions**:
- Verify CSV has proper header row
- Check for encoding issues (use UTF-8)
- Ensure data rows exist after header
- Review file content for malformed data

### AI Query Issues

#### "Failed to generate pandas code" Error
**Symptoms**: AI queries return error instead of results
**Solutions**:
- Check OpenAI API key is configured in `.env`
- Verify API key has sufficient credits
- Check network connectivity to OpenAI
- Review query complexity and clarity

#### Generated Code Execution Fails
**Symptoms**: AI generates code but execution fails
**Solutions**:
- Check DataFrame column names match the query
- Verify data types are appropriate for the operation
- Review error messages for specific issues
- Try simpler queries to test functionality

### Performance Issues

#### Slow File Processing
**Solutions**:
- Check file size (large files take longer)
- Monitor server memory usage
- Verify disk I/O performance
- Consider splitting large files

#### High Memory Usage
**Solutions**:
- Monitor DataFrame memory usage
- Delete unused DataFrames
- Check for memory leaks in browser
- Restart application if needed

#### Slow AI Response
**Solutions**:
- Check OpenAI API response times
- Verify network connectivity
- Review query complexity
- Consider using simpler queries

### Application Issues

#### Backend Server Not Starting
**Symptoms**: "Connection refused" or server errors
**Solutions**:
- Check port 3001 is not in use
- Verify Node.js version (18+ required)
- Check environment variables are set
- Review server logs for specific errors

#### Frontend Not Loading
**Symptoms**: Blank page or loading errors
**Solutions**:
- Check port 3000 is not in use
- Verify all dependencies are installed
- Clear browser cache
- Check browser console for errors

## Getting Help

### Log Files
- Backend logs: Check console output where `npm run dev` was started
- Frontend logs: Check browser developer console
- Application logs: Check for DataFrame operations and errors

### Environment Check
```bash
# Verify environment variables
cat apps/backend/.env | grep OPENAI_API_KEY

# Check file permissions
ls -la uploads/

# Test API connectivity
curl -X GET http://localhost:3001/health
```

### Common Log Messages
- `"DataFrame not found"`: File upload or DataFrame ID issue
- `"File parsing failed"`: Invalid file format or corruption
- `"Rate limit exceeded"`: Too many requests, wait and retry
- `"OpenAI API error"`: API key or network connectivity issue
- `"Code execution failed"`: Generated pandas code has errors

### Debug Steps

1. **Check Application Status**
   ```bash
   # Verify all services are running
   ps aux | grep -E "(node|vite)"
   
   # Check ports are in use
   lsof -i :3000 -i :3001
   ```

2. **Test File Upload**
   ```bash
   # Test API directly
   curl -X POST http://localhost:3001/api/files/upload \
     -F "file=@test.csv"
   ```

3. **Test AI Integration**
   ```bash
   # Test OpenAI connection
   curl -X POST http://localhost:3001/api/llm/nl-to-pandas \
     -H "Content-Type: application/json" \
     -d '{"query":"show first 5 rows"}'
   ```

4. **Check Memory Usage**
   ```bash
   # Monitor DataFrame memory
   curl -X GET http://localhost:3001/api/files/dataframes
   ```

## Performance Optimization

### For Large Files
- Split files into smaller chunks
- Use simpler queries for large datasets
- Monitor memory usage during processing
- Consider upgrading server resources

### For Frequent Usage
- Implement DataFrame caching
- Optimize AI query patterns
- Monitor API rate limits
- Use efficient pandas operations

## Support

If issues persist:
1. Check the browser console for detailed error messages
2. Review server logs for backend errors
3. Verify all environment variables are set correctly
4. Test with a simple CSV file to isolate the issue
5. Check the GitHub issues page for known problems
