# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Streamable HTTP Stateless MCP Server** - a reference implementation demonstrating true stateless Model Context Protocol (MCP) architecture. Unlike traditional MCP servers that maintain sessions, this server creates fresh instances for every request, enabling infinite horizontal scaling and serverless deployment.

### Core Architecture

- **Stateless Pattern**: Every request spawns a new `McpServer` instance via `createMCPServer()` factory
- **Transport**: Uses `StreamableHTTPServerTransport` for HTTP+SSE communication
- **No Sessions**: No `Mcp-Session-Id` headers, no server-side state
- **Request Isolation**: Each HTTP request gets its own logger context with unique `requestId`
- **Express Wrapper**: Single endpoint `/mcp` handles both POST commands and GET SSE streams

### Key Components

- `src/stateless-production-server.ts`: Main server implementation with Express app, MCP factory, and all tools/prompts/resources
- Server runs on port **1071** (not the typical 3000 mentioned in some scripts)
- Fresh server instance per request pattern at `handleMCPRequest()` function
- Built-in monitoring endpoints: `/health`, `/health/detailed`, `/metrics`

## Common Commands

### Development Workflow
```bash
# Install dependencies
npm install

# Install TypeScript declarations (if build fails)
npm install --save-dev @types/express @types/cors

# Build (critical: requires ES modules with "bundler" moduleResolution)
npm run build

# Development with auto-reload
npm run dev

# Start stateless server (port 1071)
npm run start:stateless

# Background server with nohup (recommended for testing)
nohup npm run start:stateless > /tmp/stateless-server.log 2>&1 &
```

### Testing & Validation
```bash
# Run all tests
npm run test

# Integration tests only
npm run test:integration

# Test with coverage
npm run test:coverage

# Test single file/pattern
npm run test -- --testPathPattern=stateless-server

# Health check (server on 1071, not 3000)
curl -s http://localhost:1071/health

# MCP Calculator test (requires proper Accept headers)
curl -s -X POST -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"calculate","arguments":{"a":15,"b":7,"op":"add"}},"id":1}' \
  http://localhost:1071/mcp
```

### Quality & CI
```bash
# Lint code
npm run lint
npm run lint:fix

# Type checking only (no emit)
npm run typecheck

# Format code
npm run format

# Full CI pipeline
npm run ci
```

### MCP Inspector Testing
```bash
# Build first, then test with Inspector
npm run build
npx @modelcontextprotocol/inspector --cli http://localhost:1071/mcp
```

## Critical Configuration Notes

### TypeScript Configuration
- **CRITICAL**: `tsconfig.json` uses `"moduleResolution": "bundler"` (not "node") to generate proper ES modules
- Package.json specifies `"type": "module"` requiring ES module output
- Build outputs to `dist/` directory with source maps and declarations

### MCP Transport Requirements
- Clients must send `Accept: application/json, text/event-stream` header
- Server responds with SSE streams for real-time communication
- No session handshake - each request is independent

### Server Behavior
- **Port**: Always 1071 (despite some scripts mentioning 3000)
- **Logging**: Structured JSON logs with request correlation via `requestId`
- **Cleanup**: Transport and server instances are disposed after each request
- **Rate Limiting**: 1000 requests per 15-minute window on `/mcp` endpoint

## Development Patterns

### Adding New Tools
Tools are defined in `createMCPServer()` factory. Each tool gets a fresh server instance per call:
- Use `z.` schemas for parameter validation
- Generate unique `requestId` for request correlation
- Implement progress notifications via `sendNotification` for streaming tools
- Follow stateless principle - no cross-request state

### Testing Stateless Behavior
- Tests should verify fresh server instances are created
- Mock `createMCPServer()` to verify isolation
- Test concurrent requests don't interfere
- Validate no shared state between requests

### Monitoring Production
- Use `/health/detailed` for comprehensive system status
- Monitor logs for request correlation and performance
- `/metrics` endpoint provides Prometheus-style metrics
- Server uptime in `/stats` resource reflects process uptime only

This server is designed for serverless environments where each request may hit a different instance, making traditional session-based patterns impossible.