# MCP REST API Server

A production-ready Model Context Protocol (MCP) server that provides REST API integration capabilities with advanced response processing optimized for Claude and other LLMs.

## 🚀 Features

- **Official MCP SDK Integration**: Built on `@modelcontextprotocol/sdk`
- **Dual Transport Support**: Both stdio and Streamable HTTP transports
- **Production-Ready**: Redis integration, health checks, monitoring
- **Hot-Reloadable Configuration**: Dynamic tool and API management
- **Claude-Optimized Processing**: Token estimation and response truncation
- **Rate Limiting**: Redis-backed rate limiting per API
- **Type Safety**: Full TypeScript with Zod validation

## 🆕 Branch 2 - Basic MCP Server (Current)

### ✅ Implemented Features

- **Core MCP Server**: `RestApiMcpServer` class wrapping the official MCP SDK
- **Dual Transport Support**: Both stdio and Streamable HTTP transports working
- **Redis Integration**: Full Redis client with utilities for caching, rate limiting, and sessions
- **Health Monitoring**: `/health` and `/metrics` endpoints for monitoring
- **Default Tools**: `health_check`, `echo`, and `redis_test` tools for testing
- **Session Management**: HTTP session handling with automatic cleanup
- **Error Handling**: Comprehensive error handling with graceful degradation
- **Testing Framework**: Unit and integration tests with Redis support

### 🔧 Available Tools

1. **health_check**: Check server health and status
2. **echo**: Echo back messages for testing
3. **redis_test**: Test Redis operations (when Redis is available)

## 📋 Prerequisites

- Node.js 20+ (LTS recommended)
- Redis 7+ (for production features)
- npm 10+

## 🏗 Installation

1. **Clone the repository**:
```bash
git clone https://github.com/oleksandrsirenko/mcp-rest-api-server
cd mcp-rest-api-server
```

2. **Install dependencies**:
```bash
npm install
```

3. **Set up environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Run setup script**:
```bash
npm run setup
```

## 🔧 Development

### Quick Start

**Start Redis:**
```bash
npm run docker:redis
```

**Build and run:**
```bash
npm run build
npm run start:http
```

### Development Mode

**HTTP transport (recommended for development):**
```bash
npm run dev:http
```

**stdio transport (for Claude Desktop testing):**
```bash
npm run dev:stdio
```

**Auto-detect transport:**
```bash
npm run dev
```

### Docker Development

**Full development environment:**
```bash
npm run docker:dev
```

This starts both Redis and the MCP server with hot-reloading.

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Integration tests only
npm run test:integration

# UI mode
npm run test:ui
```

## 🔍 Code Quality

```bash
# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Type checking
npm run type-check
```

## 🚦 Health Monitoring

### Health Check
```bash
# Manual check
curl http://localhost:3000/health

# Or use npm script
npm run health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-03-14T15:30:00Z",
  "version": "0.1.0",
  "transport": "http",
  "redis": "connected",
  "tools": 3,
  "uptime": 123.45
}
```

### Metrics
```bash
curl http://localhost:3000/metrics
```

**Response:**
```json
{
  "memory": {
    "rss": 50331648,
    "heapTotal": 20971520,
    "heapUsed": 15728640
  },
  "uptime": 123.45,
  "tools": 3,
  "activeSessions": 2,
  "redis": "connected"
}
```

## 🔌 MCP Integration

### With Claude Desktop

1. **Build the project**:
```bash
npm run build
```

2. **Claude Desktop config** is automatically created by setup script at:
   `~/.config/claude/claude_desktop_config.json`

3. **Restart Claude Desktop** and look for the "rest-api" server

### With MCP Inspector

**Test your server:**
```bash
npm run mcp:inspect
```

Or manually:
```bash
npx @modelcontextprotocol/inspector node dist/index.js --transport=stdio
```

### HTTP Client Integration

**Connect to HTTP transport:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test-client", "version": "1.0.0"}
    }
  }'
```

## 🛠 Server Configuration

### Transport Options

```bash
# stdio only (for Claude Desktop)
npm run start:stdio

# HTTP only (for web deployment)  
npm run start:http

# Both transports (default)
npm start
```

### Environment Variables

Key variables for Branch 2:

```bash
# Server Configuration
TRANSPORT=http                    # stdio, http, both
PORT=3000
HOST=localhost

# Redis Configuration  
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# Logging
LOG_LEVEL=info                   # error, warn, info, debug
```

## 🏭 Production Build

```bash
# Build the project
npm run build

# Start production server
npm start

# Or with specific transport
npm run start:http
npm run start:stdio
```

## 🐳 Docker Deployment

**Development:**
```bash
npm run docker:dev
```

**Production:**
```bash
npm run docker:prod
```

**Redis only:**
```bash
npm run docker:redis
```

## 🐛 Troubleshooting

### Common Issues

1. **Redis Connection Failed**:
   ```bash
   # Start Redis with Docker
   npm run docker:redis
   
   # Check Redis status
   docker ps | grep redis
   
   # Check Redis logs
   docker logs mcp-redis-dev
   ```

2. **Port Already in Use**:
   ```bash
   # Change PORT in .env
   PORT=3001
   
   # Or kill existing process
   lsof -ti:3000 | xargs kill
   ```

3. **Build Errors**:
   ```bash
   # Clean and rebuild
   npm run clean
   npm install
   npm run build
   ```

4. **MCP Connection Issues**:
   ```bash
   # Test server health
   npm run health
   
   # Check server logs
   npm run dev:http
   
   # Test with MCP Inspector
   npm run mcp:inspect
   ```

### Testing Redis Connection

```bash
# Test Redis connectivity
redis-cli -h localhost -p 6379 ping

# Or with Docker
docker exec mcp-redis-dev redis-cli ping
```

### Debugging MCP Protocol

**Enable debug logging:**
```bash
LOG_LEVEL=debug npm run dev:http
```

**Test MCP initialization:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    }
  }'
```

## 🧩 Branch 2 Implementation Details

### Core Components

#### RestApiMcpServer Class
- Wraps the official MCP SDK `McpServer`
- Manages both stdio and HTTP transports
- Handles session management for HTTP clients
- Provides tool registration and execution framework
- Integrates with Redis for state management

#### Redis Integration
- **RedisCache**: Caching with TTL support
- **RedisRateLimiter**: Sliding window rate limiting
- **RedisSessionManager**: HTTP session persistence
- **Connection Management**: Auto-reconnection and error handling

#### Transport Layer
- **stdio**: For Claude Desktop integration
- **HTTP**: For web deployment with session management
- **Session Handling**: UUID-based session tracking
- **Error Recovery**: Graceful degradation when Redis unavailable

#### Default Tools
- **health_check**: Server status and diagnostics
- **echo**: Message echoing for testing
- **redis_test**: Redis connectivity testing (when available)

### Architecture Decisions

1. **SDK-First Approach**: Built on official MCP SDK for protocol compliance
2. **Redis Optional**: Graceful degradation when Redis unavailable
3. **Session Management**: HTTP sessions for stateful interactions
4. **Error Boundaries**: Comprehensive error handling at all levels
5. **Test Coverage**: Unit and integration tests for reliability

## 🚀 Next Steps (Branch 3)

### Planned Features for `feature/rest-api-integration`

- **ApiManager**: REST API integration framework
- **HTTP Client**: Retry logic and circuit breaker
- **Response Processing**: Claude-compatible response optimization
- **Rate Limiting**: API-specific rate limiting with Redis
- **Configuration System**: Hot-reloadable API configurations

### API Integration Examples

After Branch 3, you'll be able to:

```typescript
// Register API integrations
server.addApiIntegration({
  id: 'weather',
  baseUrl: 'https://api.openweathermap.org/data/2.5',
  apiKey: process.env.WEATHER_API_KEY,
  tools: [
    {
      name: 'get_weather',
      endpoint: '/weather',
      method: 'GET',
      parameters: { q: 'string', units: 'string' }
    }
  ]
});
```

## 📚 Documentation

- [MCP Specification](https://spec.modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Redis Documentation](https://redis.io/docs)

## 🤝 Development Workflow

This project follows a branch-based development workflow:

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and commit: `git commit -m "feat: your feature"`
3. Push branch: `git push origin feature/your-feature`
4. Create PR for review
5. Merge to main after approval

### Current Branch Status

- ✅ **Branch 1**: `feature/project-setup` (Merged)
- ✅ **Branch 2**: `feature/basic-mcp-server` (Current)
- 🔄 **Branch 3**: `feature/rest-api-integration` (Next)
- 📋 **Branch 4**: `feature/config-management` (Planned)
- 📋 **Branch 5**: `feature/example-apis` (Planned)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🏷 Version

Current version: 0.1.0 (Branch 2 - Basic MCP Server Implementation)