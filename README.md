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

### Local Development (with Redis)

**Start Redis:**

```bash
docker-compose -f docker/docker-compose.dev.yml up redis -d
```

**Start the server:**

```bash
# HTTP transport (recommended for development)
npm run dev:http

# stdio transport (for Claude Desktop testing)
npm run dev:stdio

# Auto-detect transport
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
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

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

## 📁 Project Structure

```txt
├── src/
│   ├── server/              # MCP server implementation
│   ├── api/                 # REST API integration
│   ├── config/              # Configuration management
│   ├── cache/               # Redis cache layer
│   ├── utils/               # Utilities (logger, redis, etc.)
│   └── index.ts             # Main entry point
├── config/                  # Configuration files
├── docker/                  # Docker configurations
├── tests/                   # Test files
├── scripts/                 # Setup and utility scripts
└── docs/                    # Documentation
```

## 🔌 API Integration

The server will support configurable REST API integrations through JSON configuration files and environment variables. See the configuration documentation for details.

## 🚦 Health Monitoring

- **Health Check**: `GET /health`
- **Metrics**: Built-in performance monitoring
- **Logging**: Structured logging with Winston

## 🔒 Security

- **Input Validation**: Zod schema validation
- **Rate Limiting**: Redis-backed rate limiting
- **CORS**: Configurable CORS policies
- **Helmet**: Security headers

## 📊 Environment Variables

See `.env.example` for all available configuration options.

Key variables:

- `TRANSPORT`: Transport mode (stdio, http, both)
- `REDIS_URL`: Redis connection string
- `PORT`: HTTP server port
- `LOG_LEVEL`: Logging level

## 🤝 Development Workflow

This project follows a branch-based development workflow:

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and commit: `git commit -m "feat: your feature"`
3. Push branch: `git push origin feature/your-feature`
4. Create PR for review
5. Merge to main after approval

## 📚 Documentation

- [Configuration Guide](docs/CONFIGURATION.md) (coming soon)
- [API Integration Guide](docs/API_INTEGRATION.md) (coming soon)
- [Deployment Guide](docs/DEPLOYMENT.md) (coming soon)

## 🐛 Troubleshooting

### Common Issues

1. **Redis Connection Failed**:
   - Ensure Redis is running: `docker-compose -f docker/docker-compose.dev.yml up redis -d`
   - Check `REDIS_URL` in `.env`

2. **Port Already in Use**:
   - Change `PORT` in `.env`
   - Kill existing process: `lsof -ti:3000 | xargs kill`

3. **Build Errors**:
   - Clear cache: `npm run clean && npm install`
   - Check Node.js version: `node --version` (should be 20+)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🏷 Version

Current version: 0.1.0 (Development)