# Memory Optimization Guide

This document explains the memory optimizations implemented to prevent JavaScript heap out of memory errors in the AI PR Reviewer backend.

## Problem

The application was experiencing "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory" errors due to:

1. Large code diffs (up to 10,000 characters) combined with extensive prompt templates
2. Multiple concurrent requests processing large amounts of data
3. Extensive string manipulation and JSON parsing operations
4. Default Node.js heap limit being too low for the application's needs

## Solutions Implemented

### 1. Increased Node.js Heap Size

Updated npm scripts to use `--max-old-space-size=4096` flag, increasing the heap limit to 4GB:

```json
{
  "scripts": {
    "start": "node --max-old-space-size=4096 --expose-gc dist/server.js",
    "dev": "nodemon --watch 'src/**/*.ts' --exec 'node --max-old-space-size=4096 --expose-gc -r ts-node/register' src/server.ts"
  }
}
```

### 2. Manual Garbage Collection

Added `--expose-gc` flag to enable manual garbage collection and implemented strategic GC calls:

- After processing large diffs
- After completing API requests
- When memory usage is high
- On error conditions

### 3. Reduced Maximum Diff Size

Reduced the maximum allowed diff size from 10,000 to 8,000 characters to prevent memory issues with very large code changes.

### 4. Memory Monitoring

Implemented a comprehensive memory monitoring system (`src/utils/memoryMonitor.ts`):

- Real-time memory usage tracking
- Automatic garbage collection when usage exceeds 80%
- Memory threshold checks before processing large requests
- Detailed logging of memory usage patterns

### 5. Optimized Logging

Reduced memory usage from logging by:

- Limiting response logging to previews (300-500 characters)
- Truncating large JSON responses in logs
- Using memory-efficient string operations

### 6. Memory Threshold Checks

Added proactive memory management:

- Check memory usage before processing diffs larger than 4,000 characters
- Force garbage collection if heap usage exceeds 800MB
- Monitor memory usage during development

## Usage

### Development

The memory monitoring is automatically enabled in development mode:

```bash
npm run dev
```

You'll see memory usage logs like:

```
[Memory Monitor] Heap: 45MB / 512MB (8%)
[GC] Memory freed: 12MB
```

### Production

For production, use the optimized start script:

```bash
npm run start
```

### Testing Memory Optimizations

Run the memory test to verify optimizations are working:

```bash
npm run test:memory
```

This will make multiple requests to test memory usage patterns.

## Monitoring

### Memory Usage Logs

The application logs memory usage at key points:

- Server startup
- Before and after review requests
- When memory usage is high
- After garbage collection

### Key Metrics to Watch

- **Heap Usage**: Should stay below 80% of total heap
- **Memory Freed**: Amount of memory freed by garbage collection
- **Request Processing Time**: Should remain consistent

### Warning Signs

- Memory usage consistently above 80%
- Large amounts of memory being freed by GC
- Increasing memory usage over time
- Slower response times

## Troubleshooting

### If Memory Issues Persist

1. **Increase heap size further**:

   ```bash
   node --max-old-space-size=8192 dist/server.js
   ```

2. **Reduce concurrent requests**:
   - Lower the rate limiter settings in `app.ts`
   - Implement request queuing

3. **Optimize prompt templates**:
   - Reduce the size of system prompts
   - Use more concise templates

4. **Monitor with external tools**:

   ```bash
   # Use Node.js built-in profiler
   node --prof dist/server.js

   # Use clinic.js for profiling
   npx clinic doctor -- node dist/server.js
   ```

### Environment Variables

Set these environment variables for additional control:

```bash
# Increase heap size (alternative to command line)
export NODE_OPTIONS="--max-old-space-size=4096"

# Enable more detailed memory logging
export DEBUG=memory:*
```

## Best Practices

1. **Monitor memory usage regularly** in development
2. **Test with large diffs** to ensure stability
3. **Use the memory test script** before deploying changes
4. **Set appropriate rate limits** to prevent memory spikes
5. **Keep prompt templates concise** to reduce memory footprint

## Performance Impact

These optimizations have minimal performance impact:

- **Memory monitoring**: <1ms overhead per check
- **Garbage collection**: Temporary pause (usually <100ms)
- **Logging optimizations**: Reduced I/O overhead
- **Threshold checks**: <1ms per request

The benefits of preventing memory crashes far outweigh the minimal performance cost.
