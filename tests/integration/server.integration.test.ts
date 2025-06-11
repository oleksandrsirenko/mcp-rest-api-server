/**
 * Integration tests for the full MCP server stack
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RestApiMcpServer } from '../../src/server/RestApiMcpServer.js';

describe('MCP Server Integration', () => {
  let server: RestApiMcpServer;
  const TEST_PORT = 3002;

  beforeAll(async () => {
    server = new RestApiMcpServer({
      transport: 'http',
      port: TEST_PORT,
      host: 'localhost',
    });

    await server.start();
    
    // Wait a bit for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Health Endpoints', () => {
    it('should respond to health check', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/health`);
      expect(response.ok).toBe(true);
      
      const health = await response.json();
      expect(health).toMatchObject({
        status: 'healthy',
        version: '0.1.0',
        transport: 'http',
      });
      expect(health.timestamp).toBeDefined();
      expect(health.uptime).toBeGreaterThan(0);
    });

    it('should respond to metrics endpoint', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/metrics`);
      expect(response.ok).toBe(true);
      
      const metrics = await response.json();
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('tools');
      expect(metrics.uptime).toBeGreaterThan(0);
    });
  });

  describe('MCP Protocol Endpoints', () => {
    it('should handle MCP initialization request', async () => {
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      const response = await fetch(`http://localhost:${TEST_PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify(initRequest),
      });

      // Check if response is ok, if not, log the error
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Response status:', response.status);
        console.log('Response error:', errorText);
      }

      expect(response.ok).toBe(true);
      
      const result = await response.json();
      expect(result).toHaveProperty('jsonrpc', '2.0');
      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('result');

      // Should have session ID header
      const sessionId = response.headers.get('Mcp-Session-Id');
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^[a-f0-9-]+$/); // UUID format
    });

    it('should list tools via MCP protocol', async () => {
      // First initialize
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      };

      const initResponse = await fetch(`http://localhost:${TEST_PORT}/mcp`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify(initRequest),
      });

      expect(initResponse.ok).toBe(true);
      const sessionId = initResponse.headers.get('Mcp-Session-Id');
      expect(sessionId).toBeDefined();

      // Then list tools
      const toolsRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };

      const toolsResponse = await fetch(`http://localhost:${TEST_PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Mcp-Session-Id': sessionId!,
        },
        body: JSON.stringify(toolsRequest),
      });

      // Check if response is ok, if not, log the error
      if (!toolsResponse.ok) {
        const errorText = await toolsResponse.text();
        console.log('Tools response status:', toolsResponse.status);
        console.log('Tools response error:', errorText);
      }

      expect(toolsResponse.ok).toBe(true);
      
      const result = await toolsResponse.json();
      expect(result).toHaveProperty('jsonrpc', '2.0');
      expect(result).toHaveProperty('id', 2);
      expect(result).toHaveProperty('result');
      
      if (result.result && result.result.tools) {
        expect(result.result.tools).toBeInstanceOf(Array);
        // Should have at least health_check and echo tools
        const toolNames = result.result.tools.map((tool: any) => tool.name);
        expect(toolNames).toContain('health_check');
        expect(toolNames).toContain('echo');
      }
    });

    it('should execute tools via MCP protocol', async () => {
      // Initialize session
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      };

      const initResponse = await fetch(`http://localhost:${TEST_PORT}/mcp`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify(initRequest),
      });

      expect(initResponse.ok).toBe(true);
      const sessionId = initResponse.headers.get('Mcp-Session-Id');

      // Execute echo tool
      const toolRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'echo',
          arguments: {
            message: 'Hello MCP!'
          }
        }
      };

      const toolResponse = await fetch(`http://localhost:${TEST_PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Mcp-Session-Id': sessionId!,
        },
        body: JSON.stringify(toolRequest),
      });

      // Check if response is ok, if not, log the error
      if (!toolResponse.ok) {
        const errorText = await toolResponse.text();
        console.log('Tool response status:', toolResponse.status);
        console.log('Tool response error:', errorText);
      }

      expect(toolResponse.ok).toBe(true);
      
      const result = await toolResponse.json();
      expect(result).toHaveProperty('jsonrpc', '2.0');
      expect(result).toHaveProperty('id', 3);
      expect(result).toHaveProperty('result');
      
      if (result.result && result.result.content) {
        expect(result.result.content).toBeInstanceOf(Array);
        expect(result.result.content.length).toBeGreaterThan(0);
        expect(result.result.content[0]).toHaveProperty('type', 'text');
        expect(result.result.content[0].text).toContain('Hello MCP!');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid MCP requests gracefully', async () => {
      const invalidRequest = {
        jsonrpc: '2.0',
        id: 999,
        method: 'invalid/method',
        params: {}
      };

      const response = await fetch(`http://localhost:${TEST_PORT}/mcp`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify(invalidRequest),
      });

      // Should return a JSON-RPC response (may be success or error)
      const result = await response.json();
      expect(result).toHaveProperty('jsonrpc', '2.0');
      expect(result).toHaveProperty('id', 999);
      // Could be either result or error
      expect(result).toSatisfy((r: any) => r.result !== undefined || r.error !== undefined);
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }',
      });

      // Should return error response
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});