/**
 * Common factory type definitions used across the codebase.
 * @module types/factories
 */

import type { AnsiLogger } from 'matterbridge/logger';

/**
 * Generic factory function type that creates instances of type T from argument A.
 * Commonly used for dependency injection and service initialization.
 */
export type Factory<A, T> = (logger: AnsiLogger, arg: A) => T;
