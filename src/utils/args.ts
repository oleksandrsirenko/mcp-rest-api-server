/**
 * Command line argument parsing utilities
 */

export interface ServerArgs {
  transport: 'stdio' | 'http' | 'both';
  port: number;
  host: string;
  help: boolean;
}

export function parseArgs(): ServerArgs {
  const args = process.argv.slice(2);
  
  const config: ServerArgs = {
    transport: (process.env.TRANSPORT as 'stdio' | 'http' | 'both') || 'both',
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--transport':
      case '-t':
        if (value && ['stdio', 'http', 'both'].includes(value)) {
          config.transport = value as 'stdio' | 'http' | 'both';
          i++; // Skip next argument as it's the value
        }
        break;

      case '--port':
      case '-p':
        if (value && !isNaN(parseInt(value, 10))) {
          config.port = parseInt(value, 10);
          i++; // Skip next argument as it's the value
        }
        break;

      case '--host':
      case '-h':
        if (value) {
          config.host = value;
          i++; // Skip next argument as it's the value
        }
        break;

      case '--help':
        config.help = true;
        break;

      // Handle combined flags like --transport=http
      default:
        if (arg.startsWith('--transport=')) {
          const transportValue = arg.split('=')[1];
          if (['stdio', 'http', 'both'].includes(transportValue)) {
            config.transport = transportValue as 'stdio' | 'http' | 'both';
          }
        } else if (arg.startsWith('--port=')) {
          const portValue = arg.split('=')[1];
          if (!isNaN(parseInt(portValue, 10))) {
            config.port = parseInt(portValue, 10);
          }
        } else if (arg.startsWith('--host=')) {
          config.host = arg.split('=')[1];
        }
        break;
    }
  }

  if (config.help) {
    printHelp();
    process.exit(0);
  }

  return config;
}

function printHelp(): void {
  console.log(`
MCP REST API Server

Usage: npm start [options]
       node dist/index.js [options]

Options:
  --transport, -t    Transport mode: stdio, http, both (default: both)
  --port, -p         HTTP port (default: 3000)
  --host, -h         HTTP host (default: localhost)
  --help             Show this help message

Environment Variables:
  TRANSPORT          Same as --transport
  PORT               Same as --port
  HOST               Same as --host
  REDIS_URL          Redis connection URL
  LOG_LEVEL          Logging level (error, warn, info, debug)

Examples:
  npm start -- --transport=http --port=8080
  npm start -- --transport=stdio
  npm start -- --help

Development:
  npm run dev:http   Start with HTTP transport
  npm run dev:stdio  Start with stdio transport
  npm run dev        Start with auto-detected transport
`);
}

export function validateArgs(args: ServerArgs): void {
  if (args.port < 1 || args.port > 65535) {
    throw new Error(`Invalid port: ${args.port}. Must be between 1 and 65535.`);
  }

  if (!args.host) {
    throw new Error('Host cannot be empty');
  }

  if (!['stdio', 'http', 'both'].includes(args.transport)) {
    throw new Error(`Invalid transport: ${args.transport}. Must be stdio, http, or both.`);
  }
}