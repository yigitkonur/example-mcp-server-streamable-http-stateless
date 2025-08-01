/**
 * Shared test utilities for Stateless HTTP MCP server testing
 * Provides common test helpers and fixtures for stateless operations
 */

import { expect } from '@jest/globals';
import express from 'express';
import type { Server } from 'http';
import crypto from 'crypto';

/**
 * Standard test timeout for async operations
 */
export const TEST_TIMEOUT = 5000; // Shorter timeout for stateless

/**
 * Helper to create a stateless test Express app
 */
export async function createStatelessTestServer(
  setupServer?: (req: express.Request, res: express.Response) => Promise<void>
): Promise<{
  app: express.Application;
  server: Server;
  port: number;
  baseUrl: string;
  cleanup: () => Promise<void>;
}> {
  const app = express();
  app.use(express.json());
  
  // Stateless endpoint - no session management
  app.post('/mcp', async (req, res) => {
    if (setupServer) {
      await setupServer(req, res);
    } else {
      res.status(501).json({ error: 'Not implemented' });
    }
  });
  
  // Health endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      mode: 'stateless',
      timestamp: new Date().toISOString(),
    });
  });
  
  // Metrics endpoint
  app.get('/metrics', (_req, res) => {
    res.json({
      requests_total: 0,
      active_connections: 0,
      memory_usage: process.memoryUsage(),
    });
  });
  
  // Start server
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 3000;
      const baseUrl = `http://localhost:${port}`;
      
      resolve({
        app,
        server,
        port,
        baseUrl,
        cleanup: async () => {
          await new Promise<void>((res, rej) => {
            server.close((err) => {
              if (err) rej(err);
              else res();
            });
          });
        },
      });
    });
  });
}

/**
 * Helper to generate unique request IDs
 */
export function generateRequestId(prefix: string = 'req'): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Helper to create idempotency headers
 */
export function createIdempotencyHeaders(requestId: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Request-ID': requestId,
    'X-Idempotency-Key': requestId,
  };
}

/**
 * Helper to create authentication headers
 */
export function createAuthHeaders(type: 'jwt' | 'apikey', value: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (type === 'jwt') {
    headers['Authorization'] = `Bearer ${value}`;
  } else {
    headers['X-API-Key'] = value;
  }
  
  return headers;
}

/**
 * Test helper for stateless calculations
 */
export function createCalculationRequest(
  operation: string,
  input_1: number,
  input_2: number,
  requestId?: string
): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'calculate',
      arguments: {
        operation,
        input_1,
        input_2,
        ...(requestId && { requestId }),
      },
    },
    id: Math.floor(Math.random() * 10000),
  };
}

/**
 * Test helper for batch calculations
 */
export function createBatchCalculationRequest(
  calculations: Array<{
    operation: string;
    input_1: number;
    input_2: number;
    id?: string;
  }>,
  requestId?: string
): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'batch_calculate',
      arguments: {
        calculations,
        ...(requestId && { requestId }),
      },
    },
    id: Math.floor(Math.random() * 10000),
  };
}

/**
 * Helper to validate stateless calculation results
 */
export function validateStatelessCalculationResult(
  result: Record<string, unknown>,
  expectedValue?: number,
  expectError: boolean = false
): void {
  if (expectError) {
    expect(result['error']).toBeDefined();
  } else {
    expect(result['result']).toBeDefined();
    const resultObj = result['result'] as Record<string, unknown>;
    expect(resultObj['structuredContent']).toBeDefined();
    const content = resultObj['structuredContent'] as Record<string, unknown>;
    expect(content['timestamp']).toBeDefined();
    
    // Should NOT have session information
    expect(content['sessionId']).toBeUndefined();
    
    if (expectedValue !== undefined) {
      expect(content['result']).toBe(expectedValue);
    }
  }
}

/**
 * Test data for stateless operations
 */
export const STATELESS_TEST_DATA = {
  calculations: [
    { operation: 'add', input_1: 10, input_2: 5, expected: 15 },
    { operation: 'subtract', input_1: 20, input_2: 8, expected: 12 },
    { operation: 'multiply', input_1: 7, input_2: 6, expected: 42 },
    { operation: 'divide', input_1: 20, input_2: 4, expected: 5 },
  ],
  
  edgeCases: [
    { operation: 'divide', input_1: 10, input_2: 0, expectError: true },
    { operation: 'add', input_1: Number.MAX_SAFE_INTEGER, input_2: 1, expected: Number.MAX_SAFE_INTEGER + 1 },
    { operation: 'multiply', input_1: 0, input_2: 1000000, expected: 0 },
  ],
  
  batchCalculations: {
    small: Array.from({ length: 5 }, (_, i) => ({
      operation: 'add',
      input_1: i,
      input_2: i * 2,
      id: `small_${i}`,
    })),
    
    large: Array.from({ length: 100 }, (_, i) => ({
      operation: 'multiply',
      input_1: i % 10,
      input_2: (i % 10) + 1,
      id: `large_${i}`,
    })),
  },
};

/**
 * Helper to measure request latency
 */
export async function measureRequestLatency(
  url: string,
  options: RequestInit
): Promise<{ response: Response; latency: number }> {
  const startTime = performance.now();
  const response = await fetch(url, options);
  const latency = performance.now() - startTime;
  
  return { response, latency };
}

/**
 * Helper to calculate performance statistics
 */
export function calculateStats(latencies: number[]): {
  mean: number;
  median: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
  variance: number;
} {
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / sorted.length;
  
  const variance = sorted.reduce((acc, val) => 
    acc + Math.pow(val - mean, 2), 0
  ) / sorted.length;
  
  return {
    mean,
    median: sorted[Math.floor(sorted.length / 2)] || 0,
    min: sorted[0] || 0,
    max: sorted[sorted.length - 1] || 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
    p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
    variance,
  };
}

/**
 * Helper to simulate serverless environment
 */
export class ServerlessSimulator {
  private coldStartDelay: number;
  private isWarm: boolean = false;
  
  constructor(coldStartDelay: number = 500) {
    this.coldStartDelay = coldStartDelay;
  }
  
  async simulateColdStart(): Promise<void> {
    if (!this.isWarm) {
      await new Promise(resolve => setTimeout(resolve, this.coldStartDelay));
      this.isWarm = true;
    }
  }
  
  cool(): void {
    this.isWarm = false;
  }
}

/**
 * Helper to create mock cache for idempotency testing
 */
export class MockIdempotencyCache {
  private cache: Map<string, { result: Record<string, unknown>; timestamp: number }> = new Map();
  private ttl: number;
  
  constructor(ttl: number = 3600000) { // 1 hour default
    this.ttl = ttl;
  }
  
  async get(key: string): Promise<Record<string, unknown> | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.result;
  }
  
  async set(key: string, result: Record<string, unknown>): Promise<void> {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
}

/**
 * Helper to validate stateless response headers
 */
export function validateStatelessHeaders(headers: Headers | Record<string, string>): void {
  // Should NOT have session headers
  const sessionId = headers instanceof Headers 
    ? headers.get('mcp-session-id')
    : headers['mcp-session-id'];
  expect(sessionId).toBeUndefined();
  
  // Should have appropriate cache headers (in production)
  // const cacheControl = headers instanceof Headers 
  //   ? headers.get('cache-control')
  //   : headers['cache-control'];
  // expect(cacheControl).toBeDefined();
}

/**
 * Helper to create load test scenarios
 */
export async function runLoadTest(
  baseUrl: string,
  scenario: {
    duration: number;
    requestsPerSecond: number;
    operation: string;
  }
): Promise<{
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatency: number;
  errors: string[];
}> {
  const results = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    latencies: [] as number[],
    errors: [] as string[],
  };
  
  const intervalMs = 1000 / scenario.requestsPerSecond;
  const endTime = Date.now() + scenario.duration;
  
  while (Date.now() < endTime) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createCalculationRequest(
          scenario.operation,
          Math.random() * 100,
          Math.random() * 100
        )),
      });
      
      results.totalRequests++;
      
      if (response.ok) {
        results.successfulRequests++;
      } else {
        results.failedRequests++;
        results.errors.push(`HTTP ${response.status}`);
      }
      
      results.latencies.push(Date.now() - startTime);
    } catch (error) {
      results.failedRequests++;
      results.errors.push(error instanceof Error ? error.message : String(error));
    }
    
    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, intervalMs - elapsed);
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return {
    ...results,
    avgLatency: results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length,
    errors: [...new Set(results.errors)], // Unique errors
  };
}

/**
 * Helper to validate CDN compatibility
 */
export function validateCDNHeaders(headers: Headers | Record<string, string>): void {
  // Check for CDN-friendly headers
  const cacheControl = headers instanceof Headers 
    ? headers.get('cache-control')
    : headers['cache-control'];
  const etag = headers instanceof Headers 
    ? headers.get('etag')
    : headers['etag'];
  const lastModified = headers instanceof Headers 
    ? headers.get('last-modified')
    : headers['last-modified'];
  
  // At least one caching mechanism should be present in production
  expect(cacheControl || etag || lastModified).toBeDefined();
}

/**
 * JWT token generator for testing
 */
export function generateTestJWT(payload: Record<string, unknown> = {}): string {
  const header = Buffer.from(JSON.stringify({
    alg: 'HS256',
    typ: 'JWT',
  })).toString('base64url');
  
  const defaultPayload = {
    sub: 'test_user_123',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  };
  
  const payloadBase64 = Buffer.from(JSON.stringify(defaultPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', 'test_secret')
    .update(`${header}.${payloadBase64}`)
    .digest('base64url');
  
  return `${header}.${payloadBase64}.${signature}`;
}