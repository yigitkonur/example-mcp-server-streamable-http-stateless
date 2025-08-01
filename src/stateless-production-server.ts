/**
 * Stateless Production MCP Server
 * 
 * This implements a stateless version of the production MCP server,
 * using StreamableHTTPServerTransport for proper MCP over HTTP handling.
 * Perfect for simple, stateless operations and serverless deployments.
 */

import express, { Request, Response, NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { CallToolResult, GetPromptResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

/**
 * Simple Logger (no session context needed for stateless)
 */
class Logger {
  context: Record<string, unknown> = {};

  withContext(ctx: Record<string, unknown>): Logger {
    const newLogger = new Logger();
    newLogger.context = { ...this.context, ...ctx };
    return newLogger;
  }

  log(level: string, message: string, data?: Record<string, unknown>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      ...data
    };
    console.log(JSON.stringify(logEntry));
  }

  debug(message: string, data?: Record<string, unknown>): void { this.log('debug', message, data); }
  info(message: string, data?: Record<string, unknown>): void { this.log('info', message, data); }
  warn(message: string, data?: Record<string, unknown>): void { this.log('warn', message, data); }
  error(message: string, data?: Record<string, unknown>): void { this.log('error', message, data); }
}

const logger = new Logger();

/**
 * MCP Server Factory
 * Creates a fresh server instance with all tools, prompts, and resources
 */
function createMCPServer(): McpServer {
  const server = new McpServer(
    {
      name: 'calculator-learning-demo-stateless',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true },
        logging: {}
      }
    }
  );

  // TOOL: Calculator (Core)
  server.tool(
    'calculate', 
    'Performs arithmetic calculations in stateless mode', 
    {
      a: z.number().describe('First operand for the calculation'),
      b: z.number().describe('Second operand for the calculation'),
      op: z.enum(['add', 'subtract', 'multiply', 'divide']).describe('Arithmetic operation to perform'),
      stream: z.boolean().optional().describe('Stream intermediate result chunks'),
      precision: z.number().default(2).describe('Number of decimal places for result (default: 2)')
    }, 
    async ({ a, b, op, stream, precision = 2 }, { sendNotification }): Promise<CallToolResult> => {
      const requestId = randomUUID();
      const requestLogger = logger.withContext({ requestId });
      
      requestLogger.info('Stateless calculation requested', { a, b, op, requestId });
      
      let result: number;
      const steps: string[] = [];
      
      try {
        steps.push(`Input: ${a} ${op} ${b}`);
        
        // Stream intermediate results if requested
        if (stream && sendNotification) {
          await sendNotification({
            method: 'notifications/progress',
            params: {
              progressToken: requestId,
              progress: 0.1,
              level: 'info',
              data: 'Starting calculation...'
            }
          });
        }
        
        switch (op) {
          case 'add':
            result = a + b;
            steps.push(`Addition: ${a} + ${b} = ${result}`);
            break;
          case 'subtract':
            result = a - b;
            steps.push(`Subtraction: ${a} - ${b} = ${result}`);
            break;
          case 'multiply':
            result = a * b;
            steps.push(`Multiplication: ${a} × ${b} = ${result}`);
            break;
          case 'divide':
            if (b === 0) {
              requestLogger.error('Division by zero attempted', { a, b });
              throw new Error('Division by zero');
            }
            result = a / b;
            steps.push(`Division: ${a} ÷ ${b} = ${result}`);
            break;
        }
        
        result = parseFloat(result.toFixed(precision));
        steps.push(`Final result (${precision} decimal places): ${result}`);
        
        if (stream && sendNotification) {
          await sendNotification({
            method: 'notifications/progress',
            params: {
              progressToken: requestId,
              progress: 1.0,
              level: 'info',
              data: 'Calculation completed'
            }
          });
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `${op.toUpperCase()}: ${a} ${op === 'add' ? '+' : op === 'subtract' ? '-' : op === 'multiply' ? '×' : '÷'} ${b} = ${result}\n\nSteps:\n${steps.join('\n')}`
            }
          ],
          metadata: {
            operation: op,
            inputs: [a, b],
            result,
            steps,
            precision,
            requestId
          }
        };
      } catch (error) {
        requestLogger.error('Calculation failed', { op, error: error instanceof Error ? error.message : String(error), requestId });
        throw error;
      }
    }
  );

  // Tool: Demo Progress (Extended)
  server.tool(
    'demo_progress', 
    'Demonstrates progress notifications with 5 events', 
    {}, 
    async (_, { sendNotification }): Promise<CallToolResult> => {
      const progressId = randomUUID();
      logger.info('Demo progress started', { progressId });
      
      for (let i = 1; i <= 5; i++) {
        if (sendNotification) {
          await sendNotification({
            method: 'notifications/progress',
            params: {
              progressToken: progressId,
              progress: i / 5,
              level: 'info',
              data: `Progress step ${i} of 5`
            }
          });
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      return {
        content: [
          {
            type: 'text',
            text: 'Progress demonstration completed with 5 steps'
          }
        ]
      };
    }
  );

  // Stub Tool: Solve Math Problem (Extended)
  server.tool(
    'solve_math_problem', 
    'Solve complex mathematical problems (extended feature)', 
    {
      problem: z.string().describe('The mathematical problem to solve')
    }, 
    async ({ problem }): Promise<CallToolResult> => {
      logger.info('solve_math_problem called (stub)', { problem });
      const error: any = new Error('This feature is available in extended build');
      error.code = -32004;
      throw error;
    }
  );

  // Stub Tool: Explain Formula (Extended)
  server.tool(
    'explain_formula', 
    'Explain mathematical formulas (extended feature)', 
    {
      formula: z.string().describe('The formula to explain')
    }, 
    async ({ formula }): Promise<CallToolResult> => {
      logger.info('explain_formula called (stub)', { formula });
      const error: any = new Error('This feature is available in extended build');
      error.code = -32004;
      throw error;
    }
  );

  // Stub Tool: Calculator Assistant (Extended)
  server.tool(
    'calculator_assistant', 
    'Advanced calculator assistant (extended feature)', 
    {
      query: z.string().describe('The calculation query')
    }, 
    async ({ query }): Promise<CallToolResult> => {
      logger.info('calculator_assistant called (stub)', { query });
      const error: any = new Error('This feature is available in extended build');
      error.code = -32004;
      throw error;
    }
  );

  // RESOURCE: Mathematical Constants (Core)
  server.resource(
    'math-constants', 
    'calculator://constants', 
    {
      name: 'Mathematical Constants',
      description: 'Provides fundamental mathematical constants pi and e',
      mimeType: 'application/json'
    }, 
    async (): Promise<ReadResourceResult> => {
      return {
        contents: [
          {
            uri: 'calculator://constants',
            mimeType: 'application/json',
            text: JSON.stringify({
              pi: 3.14159,
              e: 2.71828
            }, null, 2)
          }
        ]
      };
    }
  );

  // Resource: Calculator History (Always 404 - stateless)
  server.resource(
    'calculator-history', 
    'calculator://history/{id}', 
    {
      name: 'Calculator History',
      description: 'Calculator history (not available in stateless mode)',
      mimeType: 'application/json'
    }, 
    async (_uri: URL): Promise<ReadResourceResult> => {
      const error: any = new Error('404 Not Found');
      error.code = -32602;
      throw error;
    }
  );

  // Resource: Calculator Stats
  server.resource(
    'calculator-stats', 
    'calculator://stats', 
    {
      name: 'Calculator Statistics',
      description: 'Basic server statistics',
      mimeType: 'application/json'
    }, 
    async (): Promise<ReadResourceResult> => {
      return {
        contents: [
          {
            uri: 'calculator://stats',
            mimeType: 'application/json',
            text: JSON.stringify({
              uptimeMs: process.uptime() * 1000
            }, null, 2)
          }
        ]
      };
    }
  );

  // Resource: Formula Library (Extended)
  server.resource(
    'formula-library', 
    'formulas://library', 
    {
      name: 'Mathematical Formula Library',
      description: 'Collection of mathematical formulas with examples',
      mimeType: 'application/json'
    }, 
    async (): Promise<ReadResourceResult> => {
      return {
        contents: [
          {
            uri: 'formulas://library',
            mimeType: 'application/json',
            text: JSON.stringify([
              {
                name: 'Quadratic Formula',
                formula: 'x = (-b ± √(b² - 4ac)) / 2a',
                category: 'algebra'
              },
              {
                name: 'Pythagorean Theorem', 
                formula: 'a² + b² = c²',
                category: 'geometry'
              },
              {
                name: 'Distance Formula',
                formula: 'd = √((x₂-x₁)² + (y₂-y₁)²)',
                category: 'geometry'
              },
              {
                name: 'Compound Interest',
                formula: 'A = P(1 + r/n)^(nt)',
                category: 'finance'
              },
              {
                name: 'Area of Circle',
                formula: 'A = πr²',
                category: 'geometry'
              },
              {
                name: 'Euler\'s Identity',
                formula: 'e^(iπ) + 1 = 0',
                category: 'complex'
              },
              {
                name: 'Law of Sines',
                formula: 'a/sin(A) = b/sin(B) = c/sin(C)',
                category: 'trigonometry'
              },
              {
                name: 'Law of Cosines',
                formula: 'c² = a² + b² - 2ab·cos(C)',
                category: 'trigonometry'
              },
              {
                name: 'Binomial Theorem',
                formula: '(x+y)^n = Σ(n,k)·x^(n-k)·y^k',
                category: 'algebra'
              },
              {
                name: 'Derivative Power Rule',
                formula: 'd/dx(x^n) = n·x^(n-1)',
                category: 'calculus'
              }
            ], null, 2)
          }
        ]
      };
    }
  );

  // Resource: Current Request Info (Extended)
  server.resource(
    'request-info', 
    'request://current', 
    {
      name: 'Current Request Information',
      description: 'Information about the current stateless request',
      mimeType: 'application/json'
    }, 
    async (): Promise<ReadResourceResult> => {
      const requestId = randomUUID();
      return {
        contents: [
          {
            uri: 'request://current',
            mimeType: 'application/json',
            text: JSON.stringify({
              requestId,
              timestamp: new Date().toISOString(),
              serverInfo: {
                name: 'calculator-learning-demo-stateless',
                version: '1.0.0',
                pattern: 'stateless'
              }
            }, null, 2)
          }
        ]
      };
    }
  );

  // PROMPT: Explain Calculation (Core)
  server.prompt(
    'explain-calculation', 
    'Explains how to perform a calculation step by step', 
    {
      calculation: z.string().describe('The calculation to explain'),
      level: z.enum(['basic', 'intermediate', 'advanced']).optional()
    }, 
    async ({ calculation, level = 'intermediate' }): Promise<GetPromptResult> => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please explain how to solve this calculation step by step: "${calculation}". 
              
Target level: ${level}
- For basic: Use simple terms and break down each step
- For intermediate: Include mathematical notation and properties
- For advanced: Discuss alternative methods and optimizations

Format your response with clear numbered steps.`
            }
          }
        ]
      };
    }
  );

  // Prompt: Generate Problems (Core)
  server.prompt(
    'generate-problems', 
    'Generates practice math problems', 
    {
      topic: z.string().describe('The mathematical topic'),
      difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
      count: z.string().optional().describe('Number of problems (1-10)')
    }, 
    async ({ topic, difficulty = 'medium', count = '5' }): Promise<GetPromptResult> => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Generate ${count} practice problems about "${topic}" at ${difficulty} difficulty level.

Requirements:
- Problems should progressively build on concepts
- Include variety in problem types
- Provide answer key at the end
- Format as numbered list

Example format:
1. [Problem statement]
2. [Problem statement]
...

Answer Key:
1. [Answer with brief explanation]
2. [Answer with brief explanation]`
            }
          }
        ]
      };
    }
  );

  // Prompt: Calculator Tutor (Optional)
  server.prompt(
    'calculator-tutor', 
    'Interactive calculator tutoring session', 
    {
      topic: z.string().optional().describe('Specific topic to focus on'),
      studentLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional()
    }, 
    async ({ topic, studentLevel = 'intermediate' }): Promise<GetPromptResult> => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Act as a friendly calculator tutor for a ${studentLevel} student${topic ? ` learning about ${topic}` : ''}.

Guidelines:
- Start with a warm greeting
- Assess current understanding with a simple question
- Provide encouragement and positive reinforcement
- Use the calculate tool to demonstrate concepts
- Adapt explanations to the student's level
- End with a practice problem for the student

Be patient, encouraging, and make learning fun!`
            }
          }
        ]
      };
    }
  );

  // Added for extra debuggability
  server.server.onerror = console.error.bind(console);

  return server;
}

/**
 * Configuration
 */
const config = {
  port: parseInt(process.env['PORT'] || '1071'),
  corsOrigin: process.env['CORS_ORIGIN'] || '*',
  enableMetrics: process.env['ENABLE_METRICS'] !== 'false',
  logLevel: process.env['LOG_LEVEL'] || 'info',
  rateLimitMax: parseInt(process.env['RATE_LIMIT_MAX'] || '1000'),
  rateLimitWindow: parseInt(process.env['RATE_LIMIT_WINDOW'] || '900000') // 15 minutes
};

/**
 * Express Application Setup
 */
async function createApp(): Promise<express.Application> {
  const app = express();

  // CORS Configuration
  app.use(cors({
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'], // Allow GET for health checks, POST for MCP
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: []
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimitWindow,
    max: config.rateLimitMax,
    message: {
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Too many requests. Please try again later.'
      },
      id: null
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/mcp', limiter);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    res.locals['requestId'] = requestId;

    logger.withContext({ requestId }).debug('HTTP request received', {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      clientIp: req.ip
    });

    next();
  });

  // ==========================================
  // MCP ENDPOINTS (STATELESS PATTERN)
  // ==========================================

  // MCP Handler - Handle both POST commands and GET SSE streams
  const handleMCPRequest = async (req: Request, res: Response) => {
    const requestId = res.locals['requestId'];
    const requestLogger = logger.withContext({ requestId });

    try {
      requestLogger.debug('Received MCP request', {
        method: req.method,
        headers: req.headers,
        contentType: req.headers['content-type'],
        body: req.method === 'POST' ? req.body : 'N/A (GET request)'
      });

      // Create fresh server instance for this request
      const server = createMCPServer();
      requestLogger.info('Created fresh MCP server instance');

      // Create stateless transport
      const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
      });

      // Added for extra debuggability
      transport.onerror = console.error.bind(console);

      await server.connect(transport);

      // Let the transport handle both POST commands and GET SSE streams
      await transport.handleRequest(req, res, req.method === 'POST' ? req.body : undefined);

      res.on('close', () => {
        requestLogger.debug('Request closed, cleaning up transport and server');
        transport.close();
        server.close();
      });

    } catch (error) {
      requestLogger.error('MCP request failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal server error'
          },
          id: req.body?.id || null
        });
      }
    }
  };

  // POST /mcp - Stateless Command Processing
  app.post('/mcp', handleMCPRequest);

  // GET /mcp - SSE Stream Establishment  
  app.get('/mcp', handleMCPRequest);

  // ==========================================
  // MONITORING ENDPOINTS
  // ==========================================

  // Health Check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      pattern: 'stateless',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: '1.0.0'
    });
  });

  // Detailed Health Check
  app.get('/health/detailed', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      pattern: 'stateless',
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version
      },
      application: {
        version: '1.0.0',
        config: {
          port: config.port,
          rateLimitMax: config.rateLimitMax
        }
      },
      characteristics: {
        persistent: false,
        sessionManagement: false,
        resumability: false,
        memoryModel: 'ephemeral',
        sseSupport: true
      }
    });
  });

  // Basic Metrics (Prometheus-style)
  app.get('/metrics', (_req: Request, res: Response) => {
    res.set('Content-Type', 'text/plain');
    res.send(`# HELP nodejs_memory_usage_bytes Node.js memory usage
# TYPE nodejs_memory_usage_bytes gauge
nodejs_memory_usage_bytes{type="rss"} ${process.memoryUsage().rss}
nodejs_memory_usage_bytes{type="heapTotal"} ${process.memoryUsage().heapTotal}
nodejs_memory_usage_bytes{type="heapUsed"} ${process.memoryUsage().heapUsed}

# HELP nodejs_uptime_seconds Node.js uptime in seconds
# TYPE nodejs_uptime_seconds counter
nodejs_uptime_seconds ${process.uptime()}

# HELP mcp_pattern MCP server pattern type
# TYPE mcp_pattern gauge
mcp_pattern{type="stateless"} 1
`);
  });

  return app;
}

/**
 * Server Initialization
 */
async function startServer(): Promise<void> {
  try {
    const app = await createApp();
    const server = app.listen(config.port, () => {
      logger.info('Stateless MCP Server started', {
        port: config.port,
        corsOrigin: config.corsOrigin,
        rateLimitMax: config.rateLimitMax,
        pattern: 'stateless'
      });

      logger.info('Available endpoints', {
        mcp: {
          command: `POST http://localhost:${config.port}/mcp`
        },
        monitoring: {
          health: `GET http://localhost:${config.port}/health`,
          detailedHealth: `GET http://localhost:${config.port}/health/detailed`,
          metrics: `GET http://localhost:${config.port}/metrics`
        },
        notes: {
          sseSupport: true,
          sessionManagement: false,
          pattern: 'stateless'
        }
      });
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down stateless MCP server...');
      server.close(() => {
        logger.info('Server closed successfully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server if running directly (not being imported)
if (!process.env['NODE_ENV'] || process.env['NODE_ENV'] !== 'test') {
  startServer().catch((error) => {
    logger.error('Server startup failed', { error });
    process.exit(1);
  });
}

export { createMCPServer, createApp, startServer };