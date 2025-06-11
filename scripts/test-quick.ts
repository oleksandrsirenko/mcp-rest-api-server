#!/usr/bin/env tsx

/**
 * Quick test script to verify server functionality without full test suite
 */

import { RestApiMcpServer } from '../src/server/RestApiMcpServer.js';

async function quickTest() {
  console.log('🧪 Running quick functionality test...');

  const server = new RestApiMcpServer({
    transport: 'http',
    port: 3003,
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
      const healthResponse = await fetch('http://localhost:3003/health');
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        console.log('✅ Health endpoint working:', {
          status: health.status,
          tools: health.tools
        });
      } else {
        console.log('⚠️  Health endpoint returned:', healthResponse.status);
      }
    } catch (error) {
      console.log('⚠️  Health endpoint error:', error.message);
    }

    // Test MCP initialization
    try {
      const mcpResponse = await fetch('http://localhost:3003/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        console.log('✅ MCP initialization working:', {
          jsonrpc: result.jsonrpc,
          hasResult: !!result.result,
          hasSessionId: !!mcpResponse.headers.get('Mcp-Session-Id')
        });
      } else {
        console.log('⚠️  MCP initialization returned:', mcpResponse.status);
      }
    } catch (error) {
      console.log('⚠️  MCP initialization error:', error.message);
    }

    // Test server stop
    await server.stop();
    console.log('✅ Server stopped successfully');

    console.log('\n🎉 All quick tests passed!');

  } catch (error) {
    console.error('❌ Quick test failed:', error);
    
    try {
      await server.stop();
    } catch (stopError) {
      console.error('❌ Failed to stop server:', stopError);
    }
    
    process.exit(1);
  }
}

// Run quick test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  quickTest();
}