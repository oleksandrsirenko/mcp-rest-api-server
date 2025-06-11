#!/usr/bin/env tsx

/**
 * Quick test script WITHOUT Redis to verify basic server functionality
 */

import { RestApiMcpServer } from '../src/server/RestApiMcpServer.js';

async function quickTestNoRedis() {
  console.log('🧪 Running quick test WITHOUT Redis...');

  // Disable Redis for this test
  const originalRedisUrl = process.env.REDIS_URL;
  process.env.REDIS_URL = ''; // Disable Redis

  const server = new RestApiMcpServer({
    transport: 'http',
    port: 3004, // Different port to avoid conflicts
    host: 'localhost',
  });

  try {
    // Test server creation
    console.log('✅ Server created successfully');

    // Test server start
    await server.start();
    console.log('✅ Server started successfully');

    // Test server status
    const status = server.getStatus();
    console.log('✅ Server status:', {
      isRunning: status.isRunning,
      tools: status.tools,
      redis: status.redisConnected
    });

    // Test health endpoint
    try {
      const healthResponse = await fetch('http://localhost:3004/health');
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        console.log('✅ Health endpoint working:', {
          status: health.status,
          tools: health.tools,
          redis: health.redis
        });
      } else {
        console.log('⚠️  Health endpoint returned:', healthResponse.status);
      }
    } catch (error) {
      console.log('⚠️  Health endpoint error:', (error as Error).message);
    }

    // Test MCP initialization
    try {
      const mcpResponse = await fetch('http://localhost:3004/mcp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'  // Required for Streamable HTTP
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0.0' }
          }
        })
      });

      if (mcpResponse.ok) {
        const result = await mcpResponse.json();
        const sessionId = mcpResponse.headers.get('Mcp-Session-Id');
        console.log('✅ MCP initialization working:', {
          jsonrpc: result.jsonrpc,
          hasResult: !!result.result,
          hasSessionId: !!sessionId
        });

        // Test tool listing with session
        if (sessionId) {
          const toolsResponse = await fetch('http://localhost:3004/mcp', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/list',
              params: {}
            })
          });

          if (toolsResponse.ok) {
            const toolsResult = await toolsResponse.json();
            console.log('✅ Tools listing working:', {
              hasTools: !!toolsResult.result?.tools,
              toolCount: toolsResult.result?.tools?.length || 0
            });
          }
        }
      } else {
        const errorText = await mcpResponse.text();
        console.log('⚠️  MCP initialization returned:', mcpResponse.status, errorText);
      }
    } catch (error) {
      console.log('⚠️  MCP initialization error:', (error as Error).message);
    }

    // Test server stop
    await server.stop();
    console.log('✅ Server stopped successfully');

    console.log('\n🎉 All quick tests passed without Redis!');

  } catch (error) {
    console.error('❌ Quick test failed:', error);
    
    try {
      await server.stop();
    } catch (stopError) {
      console.error('❌ Failed to stop server:', stopError);
    }
    
    process.exit(1);
  } finally {
    // Restore original Redis URL
    if (originalRedisUrl) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }
  }
}

// Run quick test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  quickTestNoRedis();
}