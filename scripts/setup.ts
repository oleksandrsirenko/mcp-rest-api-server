#!/usr/bin/env tsx

import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

interface SetupTask {
  name: string;
  check: () => Promise<boolean>;
  setup: () => Promise<void>;
  required: boolean;
}

class ProjectSetup {
  private tasks: SetupTask[] = [];

  constructor() {
    this.defineSetupTasks();
  }

  private defineSetupTasks() {
    this.tasks = [
      {
        name: 'Create environment file',
        check: () => this.fileExists('.env'),
        setup: () => this.copyEnvExample(),
        required: true,
      },
      {
        name: 'Create config directory',
        check: () => this.directoryExists('config'),
        setup: () => this.createConfigDirectory(),
        required: true,
      },
      {
        name: 'Create logs directory',
        check: () => this.directoryExists('logs'),
        setup: () => this.createLogsDirectory(),
        required: false,
      },
      {
        name: 'Create Claude Desktop config',
        check: () => this.claudeConfigExists(),
        setup: () => this.createClaudeConfig(),
        required: false,
      },
      {
        name: 'Verify Redis connection',
        check: () => this.checkRedisConnection(),
        setup: () => this.setupRedisInstructions(),
        required: false,
      },
    ];
  }

  async run() {
    console.log('🚀 Setting up MCP REST API Server...\n');

    for (const task of this.tasks) {
      try {
        const exists = await task.check();
        
        if (exists) {
          console.log(`✅ ${task.name} - Already configured`);
        } else {
          console.log(`⚙️  ${task.name} - Setting up...`);
          await task.setup();
          console.log(`✅ ${task.name} - Complete`);
        }
      } catch (error) {
        if (task.required) {
          console.error(`❌ ${task.name} - Failed: ${error}`);
          process.exit(1);
        } else {
          console.warn(`⚠️  ${task.name} - Warning: ${error}`);
        }
      }
    }

    await this.printNextSteps();
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await access(join(projectRoot, path));
      return true;
    } catch {
      return false;
    }
  }

  private async directoryExists(path: string): Promise<boolean> {
    try {
      await access(join(projectRoot, path));
      return true;
    } catch {
      return false;
    }
  }

  private async copyEnvExample(): Promise<void> {
    const sourcePath = join(projectRoot, '.env.example');
    const targetPath = join(projectRoot, '.env');
    
    const content = await readFile(sourcePath, 'utf8');
    await writeFile(targetPath, content);
  }

  private async createConfigDirectory(): Promise<void> {
    const configDir = join(projectRoot, 'config');
    await mkdir(configDir, { recursive: true });

    // Create initial config files
    const serverConfig = {
      name: 'mcp-rest-api-server',
      version: '0.1.0',
      description: 'Production-ready MCP server for REST API integration',
      transports: {
        stdio: {
          enabled: true,
        },
        http: {
          enabled: true,
          port: 3000,
          host: 'localhost',
        },
      },
      features: {
        hotReload: true,
        healthCheck: true,
        metrics: true,
      },
    };

    const apisConfig = {
      apis: [
        {
          id: 'jsonplaceholder',
          name: 'JSONPlaceholder',
          description: 'Fake REST API for testing and prototyping',
          baseUrl: 'https://jsonplaceholder.typicode.com',
          enabled: true,
          rateLimitPerMinute: 60,
          timeout: 10000,
          tools: [
            {
              name: 'get_posts',
              description: 'Get all posts or filter by user',
              endpoint: '/posts',
              method: 'GET',
            },
            {
              name: 'get_post',
              description: 'Get a specific post by ID',
              endpoint: '/posts/{id}',
              method: 'GET',
            },
          ],
        },
      ],
    };

    await writeFile(
      join(configDir, 'server.json'),
      JSON.stringify(serverConfig, null, 2)
    );

    await writeFile(
      join(configDir, 'apis.json'),
      JSON.stringify(apisConfig, null, 2)
    );
  }

  private async createLogsDirectory(): Promise<void> {
    await mkdir(join(projectRoot, 'logs'), { recursive: true });
  }

  private async claudeConfigExists(): Promise<boolean> {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) return false;

    try {
      const configPath = join(homeDir, '.config', 'claude', 'claude_desktop_config.json');
      await access(configPath);
      return true;
    } catch {
      return false;
    }
  }

  private async createClaudeConfig(): Promise<void> {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      throw new Error('Could not determine home directory');
    }

    const configDir = join(homeDir, '.config', 'claude');
    const configPath = join(configDir, 'claude_desktop_config.json');

    await mkdir(configDir, { recursive: true });

    const config = {
      mcpServers: {
        'rest-api': {
          command: 'node',
          args: [join(projectRoot, 'dist', 'index.js'), '--transport=stdio'],
          env: {
            NODE_ENV: 'development',
          },
        },
      },
    };

    await writeFile(configPath, JSON.stringify(config, null, 2));
  }

  private async checkRedisConnection(): Promise<boolean> {
    try {
      // We'll implement actual Redis check in the Redis utility
      // For now, just check if REDIS_URL is configured
      const envPath = join(projectRoot, '.env');
      const envContent = await readFile(envPath, 'utf8');
      return envContent.includes('REDIS_URL=redis://localhost:6379');
    } catch {
      return false;
    }
  }

  private async setupRedisInstructions(): Promise<void> {
    console.log('\n📋 Redis Setup Instructions:');
    console.log('1. Start Redis with Docker: npm run docker:dev');
    console.log('2. Or install Redis locally: https://redis.io/download');
    console.log('3. Update REDIS_URL in .env if using custom configuration\n');
  }

  private async printNextSteps(): Promise<void> {
    console.log('\n🎉 Setup complete!\n');
    console.log('📋 Next steps:');
    console.log('1. Review and update .env file with your API keys');
    console.log('2. Start Redis: npm run docker:dev (or use local Redis)');
    console.log('3. Build the project: npm run build');
    console.log('4. Start development: npm run dev:http');
    console.log('5. Test with MCP Inspector: npx @modelcontextprotocol/inspector\n');
    
    console.log('🔗 Useful commands:');
    console.log('- Development (HTTP): npm run dev:http');
    console.log('- Development (stdio): npm run dev:stdio');
    console.log('- Run tests: npm test');
    console.log('- Health check: curl http://localhost:3000/health');
    console.log('- View logs: docker logs mcp-server-dev\n');

    console.log('📚 For Claude Desktop integration:');
    console.log('1. Build the project: npm run build');
    console.log('2. Restart Claude Desktop');
    console.log('3. Look for "rest-api" server in Claude\n');

    console.log('✨ Happy coding!');
  }
}

// Run setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new ProjectSetup();
  setup.run().catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
}