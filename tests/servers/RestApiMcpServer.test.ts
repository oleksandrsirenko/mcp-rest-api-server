/**
 * RestApiMcpServer tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RestApiMcpServer } from '../../src/server/RestApiMcpServer.js';

describe('RestApiMcpServer', () => {
  let server: RestApiMcpServer;

  beforeEach(() => {
    // Create server instance for testing
    server = new RestApiMcpServer({
      transport: 'http',
      port: 3001, // Use different port for tests
      host: 'localhost',
    });
  });

  afterEach(async () => {
    // Cleanup after each test
    if (server) {
      await server.stop();
    }
  });

  describe('Constructor', () => {
    it('should create server instance with valid config', () => {
      expect(server).toBeDefined();
      expect(server.getStatus()).toMatchObject({
        isRunning: false,
        config: {
          transport: 'http',
          port: 3001,
          host: 'localhost',
        },
      });
    });

    it('should throw error with invalid port', () => {
      expect(() => {
        new RestApiMcpServer({
          transport: 'http',
          port: 70000, // Invalid port
          host: 'localhost',
        });
      }).toThrow('Invalid port');
    });
  });

  describe('Server Lifecycle', () => {
    it('should start and stop HTTP server successfully', async () => {
      const status = server.getStatus();
      expect(status.isRunning).toBe(false);

      await server.start();
      
      const runningStatus = server.getStatus();
      expect(runningStatus.isRunning).toBe(true);

      await server.stop();
      
      const stoppedStatus = server.getStatus();
      expect(stoppedStatus.isRunning).toBe(false);
    });

    it('should not allow starting server twice', async () => {
      await server.start();
      
      await expect(server.start()).rejects.toThrow('Server is already running');
      
      await server.stop();
    });

    it('should handle stop when not running', async () => {
      // Should not throw error
      await expect(server.stop()).resolves.not.toThrow();
    });
  });

  describe('Tool Registration', () => {
    it('should register default tools on start', async () => {
      await server.start();
      
      const status = server.getStatus();
      expect(status.tools).toContain('health_check');
      expect(status.tools).toContain('echo');
      
      await server.stop();
    });

    it('should register custom tools', async () => {
      const { z } = await import('zod');
      
      server.registerTool({
        name: 'test_tool',
        description: 'A test tool',
        schema: z.object({
          input: z.string()
        }),
        handler: async ({ input }) => ({ output: input.toUpperCase() })
      });

      const status = server.getStatus();
      expect(status.tools).toContain('test_tool');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate transport types', () => {
      expect(() => {
        new RestApiMcpServer({
          transport: 'invalid' as any,
          port: 3000,
          host: 'localhost',
        });
      }).toThrow('Invalid transport');
    });

    it('should validate host requirements', () => {
      expect(() => {
        new RestApiMcpServer({
          transport: 'http',
          port: 3000,
          host: '',
        });
      }).toThrow('Host cannot be empty');
    });
  });
});