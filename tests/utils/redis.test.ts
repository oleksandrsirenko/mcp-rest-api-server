/**
 * Redis utilities tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRedisClient, RedisCache, RedisRateLimiter, RedisSessionManager } from '../../src/utils/redis.js';

describe('Redis Utilities', () => {
  let client: any;
  let cache: RedisCache;
  let rateLimiter: RedisRateLimiter;
  let sessionManager: RedisSessionManager;
  let isRedisAvailable = false;

  beforeEach(async () => {
    try {
      client = createRedisClient();
      await client.connect();
      await client.ping();
      
      cache = new RedisCache(client);
      rateLimiter = new RedisRateLimiter(client);
      sessionManager = new RedisSessionManager(client);
      isRedisAvailable = true;
    } catch (error) {
      console.warn('Redis not available, skipping Redis tests');
      isRedisAvailable = false;
    }
  });

  afterEach(async () => {
    if (client?.isOpen) {
      try {
        await client.flushDb(); // Clean test database
        await client.quit();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('RedisCache', () => {
    it('should handle Redis unavailable gracefully', async () => {
      if (!isRedisAvailable) {
        // Test graceful degradation
        const mockCache = new RedisCache({} as any);
        const result = await mockCache.get('test-key');
        expect(result).toBeNull();
        return;
      }

      // Test with available Redis
      const testData = { message: 'test', timestamp: Date.now() };
      
      const setResult = await cache.set('test-key', testData, 60);
      expect(setResult).toBe(true);

      const getValue = await cache.get('test-key');
      expect(getValue).toEqual(testData);
    });

    it('should return null for non-existent keys', async () => {
      if (!isRedisAvailable) return;

      const value = await cache.get('non-existent-key');
      expect(value).toBeNull();
    });

    it('should delete cache values', async () => {
      if (!isRedisAvailable) return;

      await cache.set('delete-test', { data: 'test' });
      
      const deleteResult = await cache.del('delete-test');
      expect(deleteResult).toBe(true);

      const value = await cache.get('delete-test');
      expect(value).toBeNull();
    });

    it('should check if keys exist', async () => {
      if (!isRedisAvailable) return;

      await cache.set('exists-test', { data: 'test' });
      
      const exists = await cache.exists('exists-test');
      expect(exists).toBe(true);

      const notExists = await cache.exists('does-not-exist');
      expect(notExists).toBe(false);
    });
  });

  describe('RedisRateLimiter', () => {
    it('should allow requests within limit', async () => {
      if (!isRedisAvailable) {
        // Test graceful degradation
        const mockLimiter = new RedisRateLimiter({} as any);
        const result = await mockLimiter.checkLimit('test-user', 5, 60);
        expect(result.allowed).toBe(true);
        return;
      }

      const result = await rateLimiter.checkLimit('test-user', 5, 60);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should block requests exceeding limit', async () => {
      if (!isRedisAvailable) return;

      // Make requests up to the limit
      for (let i = 0; i < 3; i++) {
        await rateLimiter.checkLimit('limited-user', 3, 60);
      }

      // This should be blocked
      const result = await rateLimiter.checkLimit('limited-user', 3, 60);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset rate limits', async () => {
      if (!isRedisAvailable) return;

      // Exceed limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit('reset-user', 3, 60);
      }

      // Reset and try again
      await rateLimiter.resetLimit('reset-user');
      
      const result = await rateLimiter.checkLimit('reset-user', 3, 60);
      expect(result.allowed).toBe(true);
    });
  });

  describe('RedisSessionManager', () => {
    it('should create and retrieve sessions', async () => {
      if (!isRedisAvailable) return;

      const sessionData = { userId: 'test-user', timestamp: Date.now() };
      
      const created = await sessionManager.createSession('test-session', sessionData, 300);
      expect(created).toBe(true);

      const retrieved = await sessionManager.getSession('test-session');
      expect(retrieved).toEqual(sessionData);
    });

    it('should update existing sessions', async () => {
      if (!isRedisAvailable) return;

      const initialData = { count: 1 };
      const updatedData = { count: 2 };

      await sessionManager.createSession('update-session', initialData);
      
      const updated = await sessionManager.updateSession('update-session', updatedData);
      expect(updated).toBe(true);

      const retrieved = await sessionManager.getSession('update-session');
      expect(retrieved).toEqual(updatedData);
    });

    it('should delete sessions', async () => {
      if (!isRedisAvailable) return;

      await sessionManager.createSession('delete-session', { data: 'test' });
      
      const deleted = await sessionManager.deleteSession('delete-session');
      expect(deleted).toBe(true);

      const retrieved = await sessionManager.getSession('delete-session');
      expect(retrieved).toBeNull();
    });

    it('should extend session TTL', async () => {
      if (!isRedisAvailable) return;

      await sessionManager.createSession('extend-session', { data: 'test' }, 1);
      
      // Wait a bit then extend
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const extended = await sessionManager.extendSession('extend-session', 300);
      expect(extended).toBe(true);

      // Session should still exist
      const retrieved = await sessionManager.getSession('extend-session');
      expect(retrieved).not.toBeNull();
    });

    it('should return null for non-existent sessions', async () => {
      if (!isRedisAvailable) return;

      const session = await sessionManager.getSession('non-existent');
      expect(session).toBeNull();
    });
  });

  describe('Redis Client Creation', () => {
    it('should create Redis client with default configuration', () => {
      const testClient = createRedisClient();
      expect(testClient).toBeDefined();
      // Don't connect in unit tests, just verify creation
    });

    it('should handle connection configuration from environment', () => {
      // Test that environment variables are read
      const originalUrl = process.env.REDIS_URL;
      process.env.REDIS_URL = 'redis://test:6379';
      
      const testClient = createRedisClient();
      expect(testClient).toBeDefined();
      
      // Restore original
      if (originalUrl) {
        process.env.REDIS_URL = originalUrl;
      } else {
        delete process.env.REDIS_URL;
      }
    });
  });
});