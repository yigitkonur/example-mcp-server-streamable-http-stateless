# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Educational Reference Implementation** of a Stateless HTTP Streamable MCP Server. This is NOT just a simple example - it's a comprehensive teaching resource designed to demonstrate production-ready patterns, security best practices, and modern deployment strategies for Model Context Protocol servers.

### Educational Mission

This repository serves as a **masterclass** in building stateless MCP servers, covering:

- **Architecture Principles**: True stateless design enabling infinite scaling
- **Security Engineering**: DNS rebinding protection, rate limiting, error sanitization
- **SDK Integration**: Trust the SDK for protocol concerns, avoid redundant validation
- **Code Quality**: Clean, idiomatic TypeScript over premature optimizations
- **Production Readiness**: Monitoring, containerization, serverless deployment

### Core Architecture Patterns

#### 1. Fresh Instance Per Request (The Golden Rule)

```typescript
// In handleMCPRequest() - this happens for EVERY request:
const server = createMCPServer(); // 1. Fresh server instance
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // 2. Stateless mode (critical!)
  enableDnsRebindingProtection: true, // 3. Security by design
});
await server.connect(transport); // 4. Connect ephemeral instances
await transport.handleRequest(req, res); // 5. Process single request
// 6. Cleanup happens in res.on('close') listener
```

#### 2. SDK Trust Principle

- **DO**: Let `StreamableHTTPServerTransport` handle protocol validation internally
- **DON'T**: Create custom middleware to duplicate SDK validation logic
- **WHY**: SDK is the source of truth; duplicating creates maintenance burden

#### 3. Security-First Design

- DNS rebinding protection (mandatory for local servers)
- Rate limiting (1000 requests per 15-minute window)
- Production error sanitization (hide stack traces)
- Request size validation before JSON parsing

#### 4. Clean Code Over Optimization

- Simple object creation instead of object pooling
- Idiomatic TypeScript patterns
- Clear, maintainable code structure
- Performance optimizations only when proven necessary

## Key Implementation Details

### Server Configuration

- **Port**: Always 1071 (not 3000)
- **Architecture**: Stateless HTTP + SSE streaming
- **Transport**: `StreamableHTTPServerTransport` with `sessionIdGenerator: undefined`
- **Security**: DNS rebinding protection enabled by default
- **Logging**: Structured JSON with request correlation via `requestId`

### File Structure

```
src/
├── types.ts    # Data contracts (schemas, constants, interfaces)
│               # - Completely logic-free, stable dependency
│               # - All Zod schemas and TypeScript type definitions
│               # - Application-wide constants and configurations
└── server.ts   # Runtime logic (main implementation)
                # - Express app setup with middleware
                # - createMCPServer() factory and request handlers
                # - Fresh instance per request lifecycle management
                # - Monitoring endpoints (/health, /metrics)
```

### Tools Implemented

- `calculate`: Core arithmetic with progress notifications
- `demo_progress`: Progress notification demonstration
- `solve_math_problem`: Stub tool (shows graceful degradation)
- `explain_formula`: Stub tool
- `calculator_assistant`: Stub tool

### Resources Available

- `calculator://constants`: Math constants (pi, e)
- `calculator://stats`: Process uptime metrics
- `calculator://history/*`: Always returns 404 (stateless limitation)
- `formulas://library`: Mathematical formula collection
- `request://current`: Current request metadata

### Prompts Defined

- `explain-calculation`: Step-by-step calculation explanations
- `generate-problems`: Practice problem generation
- `calculator-tutor`: Interactive tutoring sessions

## Common Development Commands

### Essential Workflow

```bash
# Install dependencies
npm install

# Development with hot-reload (uses tsx)
npm run dev

# Build TypeScript to dist/
npm run build

# Start compiled server
npm start

# Run full CI pipeline (lint + typecheck + build)
npm run ci
```

### Testing & Validation

```bash
# Health checks
curl http://localhost:1071/health
curl http://localhost:1071/health/detailed
curl http://localhost:1071/metrics

# MCP tool test (note required headers)
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"calculate","arguments":{"a":15,"b":7,"op":"add"}},"id":1}' \
  http://localhost:1071/mcp

# Interactive testing
npx @modelcontextprotocol/inspector --cli http://localhost:1071/mcp
```

### Code Quality

```bash
npm run lint           # ESLint checks
npm run lint:fix       # Auto-fix linting issues
npm run typecheck      # TypeScript type checking only
npm run format         # Prettier formatting
npm run format:check   # Check formatting without changes
```

## Critical Configuration Notes

### TypeScript Settings

- Uses `"moduleResolution": "bundler"` (not "node")
- Package.json has `"type": "module"`
- Outputs ES modules to `dist/` with source maps and declarations
- Strict TypeScript configuration enabled

### Environment Variables

```bash
PORT=1071                    # Server port
CORS_ORIGIN="*"             # CORS policy (restrict in production)
LOG_LEVEL="info"            # Logging level (use "debug" for development)
RATE_LIMIT_MAX=1000         # Rate limiting
RATE_LIMIT_WINDOW=900000    # Rate limit window (15 minutes)
NODE_ENV=production         # Production optimizations
```

### Security Requirements

- DNS rebinding protection always enabled
- Rate limiting on `/mcp` endpoint
- Stack traces hidden in production
- CORS properly configured for environment
- Request size validation (1MB limit)

## Educational Patterns to Follow

### Adding New Tools

1. Define schema in `types.ts` schemas object (compiled once at startup)
2. Use Zod for parameter validation with `.describe()` for documentation
3. Generate unique `requestId` for correlation
4. Implement progress notifications if appropriate
5. Follow stateless principle - no cross-request state
6. Use `SchemaInput<'toolName'>` type for type-safe parameter handling

### Error Handling Best Practices

```typescript
// Use protocol-compliant McpError for predictable failures
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

throw new McpError(ErrorCode.InvalidParams, 'Division by zero is not allowed.');

// Global error handler catches unexpected errors
requestLogger.error('Unhandled error in MCP request handler', { error });
res.status(500).json({
  jsonrpc: '2.0',
  error: {
    code: ErrorCode.InternalError,
    message: 'An internal server error occurred.',
  },
  id: req.body?.id || null,
});
```

### Request Lifecycle Pattern

1. Generate unique `requestId` for correlation
2. Create contextual logger with `requestId`
3. Create fresh MCP server and transport instances
4. Process request through SDK transport
5. Clean up instances on response close
6. Collect metrics for monitoring

## Testing Stateless Behavior

### Verification Points

- Each request creates new server instance
- No shared state between concurrent requests
- Request correlation works via `requestId`
- Cleanup happens properly on connection close
- Metrics collection doesn't leak memory

### Common Issues to Watch

- Forgetting to set `sessionIdGenerator: undefined`
- Missing cleanup in `res.on('close')` listener
- Sharing state accidentally via closures
- Not handling concurrent requests properly

## Production Deployment

### Containerization

- Multi-stage Dockerfile (builder + production stages)
- Docker Compose with health checks
- Minimal production image (no dev dependencies)

### Serverless Ready

- `handleMCPRequest` function can be exported as serverless handler
- No persistent state to manage
- Scales infinitely without coordination

### Monitoring

- Structured JSON logging with correlation
- Prometheus-style metrics endpoint
- Health checks for load balancers
- Request duration and tool execution histograms

This server demonstrates that stateless architecture enables simpler, more secure, and infinitely scalable MCP implementations. The educational approach teaches both what to build and what NOT to build, making it an invaluable learning resource.
