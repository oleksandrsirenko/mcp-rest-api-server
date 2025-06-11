/**
 * REST API MCP Server
 * 
 * Main server class that wraps the MCP SDK and provides REST API integration capabilities.
 * Supports both stdio and Streamable HTTP transports with Redis-backed state management.
 */

import compression from 'compression';
import cors from 'cors';
import { randomUUID } from 'crypto';
import express from 'express';
import helmet from 'helmet';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import { serverLogger } from '../utils/logger.js';
import { createRedisClient } from '../utils/redis.js';

export interface RestApiMcpServerConfig {
  transport: 'stdio' | 'http' | 'both';
  port: number;
  host: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  handler: (args: any) => Promise<any>;
}

// Validation function specific to our config
function validateServerConfig(config: RestApiMcpServerConfig): void {
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port: ${config.port}. Must be between 1 and 65535.`);
  }

  if (!config.host) {
    throw new Error('Host cannot be empty');
  }

  if (!['stdio', 'http', 'both'].includes(config.transport)) {
    throw new Error(`Invalid transport: ${config.transport}. Must be stdio, http, or both.`);
  }
}

export class RestApiMcpServer {
  private mcpServer: McpServer;
  private app?: express.Application;
  private httpServer?: any;
  private redisClient?: any;
  private config: RestApiMcpServerConfig;
  private tools: Map<string, ToolDefinition> = new Map();
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();
  private isRunning = false;

  constructor(config: RestApiMcpServerConfig) {
    this.config = config;
    validateServerConfig(config);

    // Initialize MCP server with basic info
    this.mcpServer = new McpServer({
      name: 'mcp-rest-api-server',
      version: '0.1.0',
    });

    serverLogger.info('RestApiMcpServer initialized', { config });
  }

  /**
   * Start the server with the configured transport(s)
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    try {
      // Initialize Redis connection
      await this.initializeRedis();

      // Register default tools
      await this.registerDefaultTools();

      // Start the appropriate transport(s)
      if (this.config.transport === 'stdio' || this.config.transport === 'both') {
        await this.startStdioTransport();
      }

      if (this.config.transport === 'http' || this.config.transport === 'both') {
        await this.startHttpTransport();
      }

      this.isRunning = true;
      serverLogger.info('RestApiMcpServer started successfully');

    } catch (error) {
      serverLogger.error('Failed to start RestApiMcpServer:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop the server and cleanup resources
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    serverLogger.info('Stopping RestApiMcpServer...');
    await this.cleanup();
    this.isRunning = false;
    serverLogger.info('RestApiMcpServer stopped');
  }

  /**
   * Initialize Redis connection with timeout
   */
  private async initializeRedis(): Promise<void> {
    try {
      this.redisClient = createRedisClient();
      
      // Add timeout to prevent hanging
      const connectionPromise = Promise.race([
        this.redisClient.connect().then(() => this.redisClient.ping()),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
        )
      ]);

      await connectionPromise;
      serverLogger.info('Redis connection established');
    } catch (error) {
      serverLogger.warn('Redis connection failed, continuing without Redis:', error);
      
      // Clean up failed connection
      if (this.redisClient) {
        try {
          await this.redisClient.disconnect();
        } catch (disconnectError) {
          // Ignore disconnect errors
        }
      }
      this.redisClient = null;
    }
  }

  /**
   * Start stdio transport for Claude Desktop integration
   */
  private async startStdioTransport(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
    serverLogger.info('Stdio transport started');
  }

  /**
   * Start HTTP transport for web deployment
   */
  private async startHttpTransport(): Promise<void> {
    this.app = express();
    this.setupExpressMiddleware();
    this.setupHealthEndpoints();
    this.setupMcpEndpoints();

    return new Promise((resolve, reject) => {
      try {
        this.httpServer = this.app!.listen(this.config.port, this.config.host, () => {
          serverLogger.info(`HTTP transport started on ${this.config.host}:${this.config.port}`);
          resolve();
        });

        this.httpServer.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Setup Express middleware
   */
  private setupExpressMiddleware(): void {
    if (!this.app) return;

    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable for MCP compatibility
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: process.env.CORS_CREDENTIALS === 'true',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id', 'Last-Event-ID']
    }));

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.text());

    serverLogger.debug('Express middleware configured');
  }

  /**
   * Setup health check endpoints
   */
  private setupHealthEndpoints(): void {
    if (!this.app) return;

    this.app.get('/health', (_req, res) => {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        transport: this.config.transport,
        redis: this.redisClient ? 'connected' : 'disconnected',
        tools: this.tools.size,
        uptime: process.uptime(),
      };

      res.json(healthStatus);
    });

    this.app.get('/metrics', (_req, res) => {
      const metrics = {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        tools: this.tools.size,
        activeSessions: this.transports.size,
        redis: this.redisClient ? 'connected' : 'disconnected',
      };

      res.json(metrics);
    });

    serverLogger.debug('Health endpoints configured');
  }

  /**
   * Setup MCP protocol endpoints
   */
  private setupMcpEndpoints(): void {
    if (!this.app) return;

    // Main MCP endpoint for Streamable HTTP transport
    this.app.post('/mcp', async (req, res) => {
      await this.handleMcpRequest(req, res);
    });

    this.app.get('/mcp', async (req, res) => {
      await this.handleMcpSse(req, res);
    });

    this.app.delete('/mcp', async (req, res) => {
      await this.handleMcpSessionTermination(req, res);
    });

    serverLogger.debug('MCP endpoints configured');
  }

  /**
   * Handle MCP HTTP requests
   */
  private async handleMcpRequest(req: express.Request, res: express.Response): Promise<void> {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && this.transports.has(sessionId)) {
        // Reuse existing transport
        transport = this.transports.get(sessionId)!;
      } else {
        // Create new transport for new session
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            this.transports.set(newSessionId, transport);
            serverLogger.debug('New MCP session initialized', { sessionId: newSessionId });
          }
        });

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            this.transports.delete(transport.sessionId);
            serverLogger.debug('MCP session closed', { sessionId: transport.sessionId });
          }
        };

        // Connect to MCP server - use type assertion as a workaround
        await this.mcpServer.connect(transport as any);
      }

      // Handle the request
      await transport.handleRequest(req, res, req.body);

    } catch (error) {
      serverLogger.error('Error handling MCP request:', error);
      
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  }

  /**
   * Handle MCP Server-Sent Events
   */
  private async handleMcpSse(req: express.Request, res: express.Response): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    
    if (!sessionId || !this.transports.has(sessionId)) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    
    const transport = this.transports.get(sessionId)!;
    await transport.handleRequest(req, res);
  }

  /**
   * Handle MCP session termination
   */
  private async handleMcpSessionTermination(req: express.Request, res: express.Response): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    
    if (sessionId && this.transports.has(sessionId)) {
      const transport = this.transports.get(sessionId)!;
      transport.close();
      this.transports.delete(sessionId);
      serverLogger.debug('MCP session terminated', { sessionId });
    }
    
    res.status(200).send('Session terminated');
  }

  /**
   * Register a new tool
   */
  registerTool(definition: ToolDefinition): void {
    this.tools.set(definition.name, definition);

    // Register with MCP server using correct SDK API
    this.mcpServer.tool(
      definition.name,
      definition.schema,
      async (args: Record<string, unknown>) => {
        try {
          const result = await definition.handler(args);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          serverLogger.error(`Tool execution error for ${definition.name}:`, error);
          return {
            content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
            isError: true
          };
        }
      }
    );

    serverLogger.debug('Tool registered', { name: definition.name });
  }

  /**
   * Register default tools for testing
   */
  private async registerDefaultTools(): Promise<void> {
    // Health check tool
    this.registerTool({
      name: 'health_check',
      description: 'Check server health and status',
      schema: {},
      handler: async () => {
        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          redis: this.redisClient ? 'connected' : 'disconnected',
          tools: this.tools.size,
        };
      }
    });

    // Echo tool for testing
    this.registerTool({
      name: 'echo',
      description: 'Echo back the provided message',
      schema: {
        message: z.string().describe('Message to echo back')
      },
      handler: async ({ message }: { message: string }) => {
        return { echo: message, timestamp: new Date().toISOString() };
      }
    });

    // Redis test tool (if Redis is available)
    if (this.redisClient) {
      this.registerTool({
        name: 'redis_test',
        description: 'Test Redis connection and basic operations',
        schema: {
          key: z.string().optional().describe('Test key name'),
          value: z.string().optional().describe('Test value')
        },
        handler: async ({ key = 'test', value = 'test-value' }: { key?: string; value?: string }) => {
          await this.redisClient.set(key, value, 'EX', 60); // 60 second expiry
          const retrieved = await this.redisClient.get(key);
          return { key, value, retrieved, success: retrieved === value };
        }
      });
    }

    serverLogger.info('Default tools registered', { count: this.tools.size });
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    // Close HTTP server
    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer.close(() => {
          serverLogger.debug('HTTP server closed');
          resolve();
        });
      });
    }

    // Close Redis connection
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
        serverLogger.debug('Redis connection closed');
      } catch (error) {
        serverLogger.warn('Error closing Redis connection:', error);
      }
    }

    // Close all MCP transports
    for (const transport of this.transports.values()) {
      transport.close();
    }
    this.transports.clear();

    serverLogger.debug('Cleanup completed');
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      tools: Array.from(this.tools.keys()),
      activeSessions: this.transports.size,
      redisConnected: !!this.redisClient,
    };
  }
}