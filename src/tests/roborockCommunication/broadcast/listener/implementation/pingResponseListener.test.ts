import { HELLO_RESPONSE_TIMEOUT_MS } from '@/constants/timeouts.js';
import { Protocol, ResponseMessage, PingResponseListener } from '@/roborockCommunication/index.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const DUID = 'test-duid';

function createMockMessage(isHello = true) {
  return {
    isForProtocol: vi.fn().mockImplementation((proto) => isHello && proto === Protocol.hello_response),
  } as unknown as ResponseMessage;
}

describe('PingResponseListener', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when hello_response message received', async () => {
    const listener = new PingResponseListener(DUID);
    const promise = listener.waitFor();
    const msg = createMockMessage(true);
    // Simulate receiving the message before timeout
    await listener.onMessage(msg);
    // Run all timers to ensure no pending
    vi.runAllTimers();
    await expect(promise).resolves.toBe(msg);
  });

  it('does not resolve for non-hello_response message', async () => {
    const listener = new PingResponseListener(DUID);
    const promise = listener.waitFor();
    const msg = createMockMessage(false);
    await listener.onMessage(msg);
    // Advance time less than timeout to ensure not resolved
    vi.advanceTimersByTime(10);
    // Promise should still be pending, so race with a resolved value
    let resolved = false;
    promise.then(() => {
      resolved = true;
    });
    await Promise.resolve(); // allow microtasks
    expect(resolved).toBe(false);
  });

  it('rejects if timeout elapses', async () => {
    const listener = new PingResponseListener(DUID);
    const promise = listener.waitFor();
    vi.advanceTimersByTime(HELLO_RESPONSE_TIMEOUT_MS);
    await expect(promise).rejects.toMatch(/no ping response/);
  });
});
