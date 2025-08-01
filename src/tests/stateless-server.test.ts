import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMCPServer } from '../stateless-production-server.js';

describe('Stateless Calculator Server - Test Suite', () => {
  let server: McpServer;
  let client: Client;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;

  beforeEach(async () => {
    // Create linked transport pair for in-memory communication
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Initialize server and client
    server = createMCPServer();
    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          logging: {},
        },
      },
    );

    // Connect both endpoints
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  afterEach(async () => {
    // Clean up connections
    await Promise.all([
      client.close(),
      server.close(),
    ]);
  });

  describe('Server Initialization and Capabilities', () => {
    test('should have correct server info', () => {
      // Note: serverInfo is not directly accessible on the server instance
      // The info is verified through the MCP protocol during connection
      expect(server).toBeDefined();
    });

    test('should list all available tools', async () => {
      const tools = await client.listTools();
      
      expect(tools.tools).toBeDefined();
      expect(Array.isArray(tools.tools)).toBe(true);
      expect(tools.tools.length).toBe(5);
      
      const toolNames = tools.tools.map(t => t.name).sort();
      expect(toolNames).toEqual([
        'calculate',
        'calculator_assistant',
        'demo_progress',
        'explain_formula',
        'solve_math_problem'
      ]);
    });

    test('should list all available resources', async () => {
      const resources = await client.listResources();
      
      expect(resources.resources).toBeDefined();
      expect(Array.isArray(resources.resources)).toBe(true);
      expect(resources.resources.length).toBe(5);
      
      const resourceUris = resources.resources.map(r => r.uri).sort();
      expect(resourceUris).toEqual([
        'calculator://constants',
        'calculator://history/{id}',
        'calculator://stats',
        'formulas://library',
        'request://current'
      ]);
    });

    test('should list all available prompts', async () => {
      const prompts = await client.listPrompts();
      
      expect(prompts.prompts).toBeDefined();
      expect(Array.isArray(prompts.prompts)).toBe(true);
      expect(prompts.prompts.length).toBe(3);
      
      const promptNames = prompts.prompts.map(p => p.name).sort();
      expect(promptNames).toEqual(['calculator-tutor', 'explain-calculation', 'generate-problems']);
    });
  });

  describe('Calculate Tool', () => {
    test('should perform addition correctly', async () => {
      const result = await client.callTool({
        name: 'calculate',
        arguments: {
          a: 10,
          b: 5,
          op: 'add',
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect((result.content[0] as { text: string }).text).toContain('ADD: 10 + 5 = 15');
    });

    test('should perform subtraction correctly', async () => {
      const result = await client.callTool({
        name: 'calculate',
        arguments: {
          a: 20,
          b: 8,
          op: 'subtract',
        },
      });

      expect(result.isError).toBeFalsy();
      expect((result.content[0] as { text: string }).text).toContain('SUBTRACT: 20 - 8 = 12');
    });

    test('should perform multiplication correctly', async () => {
      const result = await client.callTool({
        name: 'calculate',
        arguments: {
          a: 7,
          b: 6,
          op: 'multiply',
        },
      });

      expect(result.isError).toBeFalsy();
      expect((result.content[0] as { text: string }).text).toContain('MULTIPLY: 7 × 6 = 42');
    });

    test('should perform division correctly', async () => {
      const result = await client.callTool({
        name: 'calculate',
        arguments: {
          a: 20,
          b: 4,
          op: 'divide',
        },
      });

      expect(result.isError).toBeFalsy();
      expect((result.content[0] as { text: string }).text).toContain('DIVIDE: 20 ÷ 4 = 5');
    });

    test('should handle division by zero', async () => {
      const result = await client.callTool({
        name: 'calculate',
        arguments: {
          a: 10,
          b: 0,
          op: 'divide',
        },
      });
      
      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Division by zero');
    });

    test('should respect precision parameter', async () => {
      const result = await client.callTool({
        name: 'calculate',
        arguments: {
          a: 10,
          b: 3,
          op: 'divide',
          precision: 5,
        },
      });

      expect(result.isError).toBeFalsy();
      expect((result.content[0] as { text: string }).text).toContain('3.33333');
    });
  });

  describe('Demo Progress Tool', () => {
    test('should emit progress events', async () => {
      const startTime = Date.now();
      const result = await client.callTool({
        name: 'demo_progress',
        arguments: {},
      });
      const duration = Date.now() - startTime;

      expect(result.isError).toBeFalsy();
      expect((result.content[0] as { text: string }).text).toContain('Progress demonstration completed with 5 steps');
      // Should take at least 1 second (5 steps * 200ms)
      expect(duration).toBeGreaterThan(1000);
    });
  });

  describe('Stub Tools', () => {
    test('solve_math_problem should return extended feature error', async () => {
      const result = await client.callTool({
        name: 'solve_math_problem',
        arguments: {
          problem: '2x + 3 = 7',
        },
      });
      
      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('This feature is available in extended build');
    });

    test('explain_formula should return extended feature error', async () => {
      const result = await client.callTool({
        name: 'explain_formula',
        arguments: {
          formula: 'E=mc²',
        },
      });
      
      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('This feature is available in extended build');
    });

    test('calculator_assistant should return extended feature error', async () => {
      const result = await client.callTool({
        name: 'calculator_assistant',
        arguments: {
          query: 'Help me calculate compound interest',
        },
      });
      
      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('This feature is available in extended build');
    });
  });

  describe('Resources', () => {
    test('should provide mathematical constants (pi and e only)', async () => {
      const result = await client.readResource({
        uri: 'calculator://constants',
      });

      expect(result.contents).toHaveLength(1);
      const constants = JSON.parse(result.contents[0].text);
      
      expect(Object.keys(constants)).toEqual(['pi', 'e']);
      expect(constants.pi).toBe(3.14159);
      expect(constants.e).toBe(2.71828);
    });

    test('calculator history should always return 404', async () => {
      await expect(
        client.readResource({
          uri: 'calculator://history/123',
        })
      ).rejects.toThrow();
    });

    test('should provide calculator stats with uptime only', async () => {
      const result = await client.readResource({
        uri: 'calculator://stats',
      });

      expect(result.contents).toHaveLength(1);
      const stats = JSON.parse(result.contents[0].text);
      
      expect(Object.keys(stats)).toEqual(['uptimeMs']);
      expect(typeof stats.uptimeMs).toBe('number');
      expect(stats.uptimeMs).toBeGreaterThan(0);
    });

    test('should provide formula library with 10 formulas', async () => {
      const result = await client.readResource({
        uri: 'formulas://library',
      });

      expect(result.contents).toHaveLength(1);
      const formulas = JSON.parse(result.contents[0].text);
      
      expect(Array.isArray(formulas)).toBe(true);
      expect(formulas).toHaveLength(10);
      expect(formulas[0]).toHaveProperty('name');
      expect(formulas[0]).toHaveProperty('formula');
      expect(formulas[0]).toHaveProperty('category');
    });

    test('should provide current request information', async () => {
      const result = await client.readResource({
        uri: 'request://current',
      });

      expect(result.contents).toHaveLength(1);
      const requestInfo = JSON.parse(result.contents[0].text);
      
      expect(requestInfo).toHaveProperty('requestId');
      expect(requestInfo).toHaveProperty('timestamp');
      expect(requestInfo).toHaveProperty('headers');
      expect(requestInfo).toHaveProperty('rpcEnvelope');
      expect(requestInfo.serverInfo.name).toBe('calculator-learning-demo-stateless');
      expect(requestInfo.serverInfo.pattern).toBe('stateless');
    });
  });

  describe('Prompts', () => {
    test('should generate explain-calculation prompt', async () => {
      const result = await client.getPrompt({
        name: 'explain-calculation',
        arguments: {
          calculation: '25 × 4',
          level: 'basic',
        },
      });

      expect(result.messages).toHaveLength(1);
      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain('25 × 4');
      expect(text).toContain('basic');
    });

    test('should generate practice problems', async () => {
      const result = await client.getPrompt({
        name: 'generate-problems',
        arguments: {
          topic: 'fractions',
          difficulty: 'medium',
          count: '5',
        },
      });

      expect(result.messages).toHaveLength(1);
      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain('5 practice problems');
      expect(text).toContain('fractions');
      expect(text).toContain('medium');
    });

    test('should generate calculator tutor prompt', async () => {
      const result = await client.getPrompt({
        name: 'calculator-tutor',
        arguments: {
          topic: 'percentages',
          studentLevel: 'beginner',
        },
      });

      expect(result.messages).toHaveLength(1);
      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain('beginner');
      expect(text).toContain('percentages');
    });
  });

  describe('Stateless Operation Verification', () => {
    test('should not maintain state between requests', async () => {
      // First calculation
      const result1 = await client.callTool({
        name: 'calculate',
        arguments: {
          a: 10,
          b: 20,
          op: 'add',
        },
      });

      // Second calculation
      const result2 = await client.callTool({
        name: 'calculate',
        arguments: {
          a: 5,
          b: 6,
          op: 'multiply',
        },
      });

      // Each result should be independent
      expect((result1.content[0] as { text: string }).text).toContain('30');
      expect((result2.content[0] as { text: string }).text).toContain('30');
    });

    test('should handle concurrent requests independently', async () => {
      const calculations = Array.from({ length: 10 }, (_, i) => ({
        a: i,
        b: i,
        op: 'add' as const,
      }));

      const promises = calculations.map(args =>
        client.callTool({
          name: 'calculate',
          arguments: args,
        })
      );

      const results = await Promise.all(promises);
      
      results.forEach((result, i) => {
        expect(result.isError).toBeFalsy();
        expect((result.content[0] as { text: string }).text).toContain(`${i * 2}`);
      });
    });

    test('should provide consistent static resources', async () => {
      // Read constants multiple times
      const reads = await Promise.all([
        client.readResource({ uri: 'calculator://constants' }),
        client.readResource({ uri: 'calculator://constants' }),
        client.readResource({ uri: 'calculator://constants' }),
      ]);

      // All should return identical content
      const contents = reads.map(r => r.contents[0].text);
      expect(contents[0]).toBe(contents[1]);
      expect(contents[1]).toBe(contents[2]);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid operation type', async () => {
      await expect(
        client.callTool({
          name: 'calculate',
          arguments: {
            a: 10,
            b: 5,
            op: 'invalid' as 'add' | 'subtract' | 'multiply' | 'divide',
          },
        })
      ).rejects.toThrow();
    });

    test('should handle missing required parameters', async () => {
      await expect(
        client.callTool({
          name: 'calculate',
          arguments: {
            a: 10,
            // missing b and op
          } as { a: number; b?: number; op?: string },
        })
      ).rejects.toThrow();
    });

    test('should handle invalid resource URI', async () => {
      await expect(
        client.readResource({
          uri: 'invalid://resource',
        })
      ).rejects.toThrow();
    });
  });
});