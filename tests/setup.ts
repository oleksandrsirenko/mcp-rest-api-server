/**
 * Test setup and utilities
 */

import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { afterAll, beforeAll } from 'vitest';

// Load test environment
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'warn'; // Reduce log noise in tests
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1'; // Use DB 1 for tests

// Global test setup
beforeAll(async () => {
  // Any global setup needed for tests
});

// Global test cleanup
afterAll(async () => {
  // Any global cleanup needed for tests
});