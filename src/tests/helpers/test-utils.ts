/**
 * Test utility functions and builders for test data construction.
 * @module tests/helpers
 */

import type { AnsiLogger } from 'matterbridge/logger';

/**
 * Creates a mock AnsiLogger for testing purposes.
 * All log methods are mocked with jest functions.
 *
 * @returns Mock AnsiLogger instance
 *
 * @example
 * ```typescript
 * const logger = createMockLogger();
 * myFunction(logger);
 * expect(logger.debug).toHaveBeenCalledWith('Expected message');
 * ```
 */
export function createMockLogger(): AnsiLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    notice: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  } as unknown as AnsiLogger;
}

/**
 * Creates a promise that resolves after the specified delay.
 * Useful for testing asynchronous behavior with timeouts.
 *
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the delay
 *
 * @example
 * ```typescript
 * await wait(100); // Wait 100ms
 * ```
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
