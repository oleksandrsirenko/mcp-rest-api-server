/**
 * Redis client utility
 * 
 * Provides Redis client configuration and connection management
 * with proper error handling and reconnection logic.
 */

import { createClient } from 'redis';
import { redisLogger } from './logger.js';

export type RedisClient = ReturnType<typeof createClient>;

/**
 * Create and configure Redis client with graceful degradation
 */
export function createRedisClient(): RedisClient {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redisPassword = process.env.REDIS_PASSWORD;
  const redisDb = parseInt(process.env.REDIS_DB || '0', 10);
  const connectTimeout = parseInt(process.env.REDIS_CONNECT_TIMEOUT || '3000', 10);

  // Build config object with proper typing
  const config: Parameters<typeof createClient>[0] = {
    url: redisUrl,
    database: redisDb,
    socket: {
      connectTimeout,
    },
  };

  // Only add password if it's defined
  if (redisPassword) {
    config.password = redisPassword;
  }

  const client = createClient(config);

  // Track connection attempts to prevent infinite loops
  let connectionAttempts = 0;
  const maxAttempts = 3;
  let isShuttingDown = false;

  // Event handlers
  client.on('connect', () => {
    redisLogger.info('Redis client connecting...', { url: redisUrl });
    connectionAttempts = 0; // Reset on successful connection
  });

  client.on('ready', () => {
    redisLogger.info('Redis client ready', { database: redisDb });
    connectionAttempts = 0; // Reset on ready
  });

  client.on('error', (error) => {
    connectionAttempts++;
    redisLogger.error('Redis client error:', { 
      error: error.message, 
      code: (error as any).code,
      attempts: connectionAttempts 
    });

    // After max attempts, stop trying to reconnect
    if (connectionAttempts >= maxAttempts && !isShuttingDown) {
      redisLogger.warn('Max Redis connection attempts reached, disabling Redis', { 
        maxAttempts,
        attempts: connectionAttempts 
      });
      isShuttingDown = true;
      
      // Disconnect and prevent further reconnection attempts
      setTimeout(() => {
        try {
          client.disconnect().catch(() => {
            // Ignore disconnect errors
          });
        } catch (error) {
          // Ignore any errors during shutdown
        }
      }, 100);
    }
  });

  client.on('end', () => {
    redisLogger.info('Redis client connection ended');
  });

  client.on('reconnecting', () => {
    if (connectionAttempts < maxAttempts) {
      redisLogger.warn('Redis client reconnecting...', { 
        attempt: connectionAttempts,
        maxAttempts 
      });
    }
  });

  return client;
}

/**
 * Redis key utilities
 */
export const RedisKeys = {
  // Session management
  session: (sessionId: string) => `mcp:session:${sessionId}`,
  sessionData: (sessionId: string) => `mcp:session:${sessionId}:data`,
  
  // Rate limiting
  rateLimit: (identifier: string) => `mcp:ratelimit:${identifier}`,
  
  // Caching
  cache: (key: string) => `mcp:cache:${key}`,
  apiResponse: (apiId: string, hash: string) => `mcp:api:${apiId}:${hash}`,
  
  // Configuration
  config: (component: string) => `mcp:config:${component}`,
  
  // Metrics
  metrics: (metric: string) => `mcp:metrics:${metric}`,
} as const;

/**
 * Redis cache helper with TTL support
 */
export class RedisCache {
  constructor(private client: RedisClient) {}

  async get<T = any>(key: string): Promise<T | null> {
    try {
      if (!this.client.isOpen) return null;
      const value = await this.client.get(RedisKeys.cache(key));
      return value ? JSON.parse(value) : null;
    } catch (error) {
      redisLogger.error('Cache get error:', { key, error: (error as Error).message });
      return null;
    }
  }

  async set<T = any>(key: string, value: T, ttlSeconds = 300): Promise<boolean> {
    try {
      if (!this.client.isOpen) return false;
      await this.client.setEx(RedisKeys.cache(key), ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      redisLogger.error('Cache set error:', { key, error: (error as Error).message });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      if (!this.client.isOpen) return false;
      await this.client.del(RedisKeys.cache(key));
      return true;
    } catch (error) {
      redisLogger.error('Cache delete error:', { key, error: (error as Error).message });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.client.isOpen) return false;
      const result = await this.client.exists(RedisKeys.cache(key));
      return result === 1;
    } catch (error) {
      redisLogger.error('Cache exists error:', { key, error: (error as Error).message });
      return false;
    }
  }
}

/**
 * Redis rate limiter using sliding window
 */
export class RedisRateLimiter {
  constructor(private client: RedisClient) {}

  async checkLimit(identifier: string, limit: number, windowSeconds = 60): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const key = RedisKeys.rateLimit(identifier);
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);

    try {
      if (!this.client.isOpen) {
        // Fail open - allow request if Redis is down
        return { allowed: true, remaining: limit - 1, resetTime: now + (windowSeconds * 1000) };
      }

      // Use pipeline for atomic operations
      const pipeline = this.client.multi();
      
      // Remove old entries
      pipeline.zRemRangeByScore(key, 0, windowStart);
      
      // Count current entries
      pipeline.zCard(key);
      
      // Add current request
      pipeline.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
      
      // Set expiry
      pipeline.expire(key, windowSeconds);
      
      const results = await pipeline.exec();
      const currentCount = results?.[1] as number || 0;
      
      const allowed = currentCount < limit;
      const remaining = Math.max(0, limit - currentCount - 1);
      const resetTime = now + (windowSeconds * 1000);

      return { allowed, remaining, resetTime };
      
    } catch (error) {
      redisLogger.error('Rate limit check error:', { identifier, error: (error as Error).message });
      // Fail open - allow request if Redis is down
      return { allowed: true, remaining: limit - 1, resetTime: now + (windowSeconds * 1000) };
    }
  }

  async resetLimit(identifier: string): Promise<boolean> {
    try {
      if (!this.client.isOpen) return false;
      await this.client.del(RedisKeys.rateLimit(identifier));
      return true;
    } catch (error) {
      redisLogger.error('Rate limit reset error:', { identifier, error: (error as Error).message });
      return false;
    }
  }
}

/**
 * Redis session manager
 */
export class RedisSessionManager {
  constructor(private client: RedisClient) {}

  async createSession(sessionId: string, data: any, ttlSeconds = 3600): Promise<boolean> {
    try {
      if (!this.client.isOpen) return false;
      await this.client.setEx(RedisKeys.sessionData(sessionId), ttlSeconds, JSON.stringify(data));
      return true;
    } catch (error) {
      redisLogger.error('Session create error:', { sessionId, error: (error as Error).message });
      return false;
    }
  }

  async getSession<T = any>(sessionId: string): Promise<T | null> {
    try {
      if (!this.client.isOpen) return null;
      const data = await this.client.get(RedisKeys.sessionData(sessionId));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      redisLogger.error('Session get error:', { sessionId, error: (error as Error).message });
      return null;
    }
  }

  async updateSession(sessionId: string, data: any, ttlSeconds = 3600): Promise<boolean> {
    try {
      if (!this.client.isOpen) return false;
      await this.client.setEx(RedisKeys.sessionData(sessionId), ttlSeconds, JSON.stringify(data));
      return true;
    } catch (error) {
      redisLogger.error('Session update error:', { sessionId, error: (error as Error).message });
      return false;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      if (!this.client.isOpen) return false;
      await this.client.del(RedisKeys.sessionData(sessionId));
      return true;
    } catch (error) {
      redisLogger.error('Session delete error:', { sessionId, error: (error as Error).message });
      return false;
    }
  }

  async extendSession(sessionId: string, ttlSeconds = 3600): Promise<boolean> {
    try {
      if (!this.client.isOpen) return false;
      await this.client.expire(RedisKeys.sessionData(sessionId), ttlSeconds);
      return true;
    } catch (error) {
      redisLogger.error('Session extend error:', { sessionId, error: (error as Error).message });
      return false;
    }
  }
}