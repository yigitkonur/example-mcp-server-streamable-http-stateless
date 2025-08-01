import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import type { Server } from 'http';
import { createApp } from '../stateless-production-server.js';

describe('Stateless HTTP Integration Tests', () => {
  let app: express.Application;
  let server: Server;
  const PORT = 1071;

  beforeAll(async () => {
    app = await createApp();
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(PORT, () => {
        console.log(`Test server started on port ${PORT}`);
        resolve(s);
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  describe('HTTP Endpoints', () => {
    test('POST /mcp should handle calculate tool', async () => {
      const response = await fetch(`http://localhost:${PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'calculate',
            arguments: {
              a: 10,
              b: 5,
              op: 'add',
            },
          },
        }),
      });

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('15');
    });

    test('POST /mcp should not include Mcp-Session-Id header', async () => {
      const response = await fetch(`http://localhost:${PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('mcp-session-id')).toBeNull();
    });

    test('GET /mcp should not be available', async () => {
      const response = await fetch(`http://localhost:${PORT}/mcp`, {
        method: 'GET',
      });

      // The stateless server doesn't support GET /mcp
      expect([404, 405]).toContain(response.status);
    });

    test('DELETE /mcp should not be available', async () => {
      const response = await fetch(`http://localhost:${PORT}/mcp`, {
        method: 'DELETE',
      });

      // The stateless server doesn't support DELETE /mcp
      expect([404, 405]).toContain(response.status);
    });

    test('Health check should work', async () => {
      const response = await fetch(`http://localhost:${PORT}/health`);
      expect(response.status).toBe(200);
      
      const health = await response.json();
      expect(health.status).toBe('healthy');
      expect(health.pattern).toBe('stateless');
      expect(health.version).toBe('1.0.0');
    });

    test('Metrics endpoint should work', async () => {
      const response = await fetch(`http://localhost:${PORT}/metrics`);
      expect(response.status).toBe(200);
      
      const metrics = await response.text();
      expect(metrics).toContain('nodejs_memory_usage_bytes');
      expect(metrics).toContain('mcp_pattern{type="stateless"}');
    });
  });

  describe('Stateless Behavior', () => {
    test('Multiple requests should be independent', async () => {
      // Make multiple requests in parallel
      const requests = Array.from({ length: 5 }, (_, i) => 
        fetch(`http://localhost:${PORT}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: i,
            method: 'tools/call',
            params: {
              name: 'calculate',
              arguments: {
                a: i,
                b: i,
                op: 'multiply',
              },
            },
          }),
        })
      );

      const responses = await Promise.all(requests);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Check results
      const results = await Promise.all(responses.map(r => r.text()));
      results.forEach((result, i) => {
        expect(result).toContain(String(i * i));
      });
    });

    test('Request with session ID should be ignored', async () => {
      const response = await fetch(`http://localhost:${PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Mcp-Session-Id': 'should-be-ignored',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'calculate',
            arguments: {
              a: 2,
              b: 3,
              op: 'add',
            },
          },
        }),
      });

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('5');
      
      // Should not return session ID
      expect(response.headers.get('mcp-session-id')).toBeNull();
    });

    test('Resource requests should work without session', async () => {
      const response = await fetch(`http://localhost:${PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'resources/read',
          params: {
            uri: 'calculator://constants',
          },
        }),
      });

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('3.14159');
      expect(text).toContain('2.71828');
    });
  });

  describe('Error Handling', () => {
    test('Invalid JSON should return error', async () => {
      const response = await fetch(`http://localhost:${PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      expect(response.status).toBe(400);
    });

    test('Missing method should return error', async () => {
      const response = await fetch(`http://localhost:${PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          params: {},
        }),
      });

      expect(response.status).toBe(200); // JSON-RPC errors return 200
      const result = await response.json();
      expect(result.error).toBeDefined();
    });

    test('Division by zero should return error', async () => {
      const response = await fetch(`http://localhost:${PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'calculate',
            arguments: {
              a: 10,
              b: 0,
              op: 'divide',
            },
          },
        }),
      });

      expect(response.status).toBe(200); // JSON-RPC errors return 200
      const result = await response.json();
      expect(result.result.isError).toBe(true);
      expect(result.result.content[0].text).toContain('Division by zero');
    });
  });

  describe('Network Resilience', () => {
    test('Interrupted connection should require full retry', async () => {
      // This tests that there's no session resumption
      const controller = new AbortController();
      
      // Start a request
      const request1 = fetch(`http://localhost:${PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'demo_progress',
            arguments: {},
          },
        }),
        signal: controller.signal,
      });

      // Abort after 100ms
      setTimeout(() => controller.abort(), 100);

      await expect(request1).rejects.toThrow();

      // Make a new request - should work independently
      const response2 = await fetch(`http://localhost:${PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'calculate',
            arguments: {
              a: 5,
              b: 5,
              op: 'add',
            },
          },
        }),
      });

      expect(response2.status).toBe(200);
      const text = await response2.text();
      expect(text).toContain('10');
    });
  });
});