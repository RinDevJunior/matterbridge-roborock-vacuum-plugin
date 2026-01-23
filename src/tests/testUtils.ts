import { vi } from 'vitest';

/**
 * Shared testing utilities for unit tests.
 * Keep these minimal and side-effect free; tests import what they need.
 */

export function makeLogger() {
  return {
    debug: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  } as any;
}

export function makeMockClientRouter(overrides: Partial<any> = {}) {
  const localClient = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
  } as any;

  return {
    registerDevice: vi.fn(),
    registerMessageListener: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    registerClient: vi.fn().mockReturnValue(localClient),
    updateNonce: vi.fn(),
    destroy: vi.fn(),
    destroyAll: vi.fn(),
    ...overrides,
  } as any;
}

export function makeLocalClientStub(overrides: Partial<any> = {}) {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    ...overrides,
  } as any;
}
