#!/usr/bin/env node

/**
 * MCP REST API Server - Main Entry Point
 * 
 * Production-ready MCP server for REST API integration with advanced response processing.
 * Supports both stdio and Streamable HTTP transports.
 */

import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env') });

import { parseArgs } from './utils/args.js';
import { logger } from './utils/logger.js';

async function main() {
  try {
    logger.info('🚀 Starting MCP REST API Server...');
    
    // Parse command line arguments
    const args = parseArgs();
    logger.info('Configuration loaded', { transport: args.transport, port: args.port });

    // Import and start the server (dynamic import for proper module loading)
    const { RestApiMcpServer } = await import('./server/RestApiMcpServer.js');
    
    const server = new RestApiMcpServer({
      transport: args.transport,
      port: args.port,
      host: args.host,
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      logger.info(`📡 Received ${signal}, shutting down gracefully...`);
      try {
        await server.stop();
        logger.info('✅ Server stopped successfully');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught exception:', error);
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('💥 Unhandled rejection:', reason);
      shutdown('unhandledRejection');
    });

    // Start the server
    await server.start();
    logger.info('✅ MCP REST API Server is running');

  } catch (error) {
    logger.error('💥 Failed to start server:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}