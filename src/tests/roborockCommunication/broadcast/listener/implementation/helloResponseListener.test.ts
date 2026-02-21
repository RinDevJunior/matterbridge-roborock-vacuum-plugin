import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HELLO_RESPONSE_TIMEOUT_MS } from '../../../../../constants/timeouts.js';
import { Protocol, ResponseMessage } from '../../../../../roborockCommunication/models/index.js';
import { asPartial, createMockLogger } from '../../../../helpers/testUtils.js';
import { HelloResponseListener } from '../../../../../roborockCommunication/routing/listeners/implementation/helloResponseListener.js';

const DUID = 'test-duid';
const protocolVersion = '1.0';

function createMockMessage(isHello = true) {
  return asPartial<ResponseMessage>({
    duid: DUID,
    isForProtocol: vi.fn().mockImplementation((proto) => isHello && proto === Protocol.hello_response),
  });
}

describe('HelloResponseListener (basic behavior)', () => {
  let listener: HelloResponseListener;
  const logger = createMockLogger();

  beforeEach(() => {
    listener = new HelloResponseListener('device-1', logger);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('resolves when a hello_response is received', async () => {
    const message = new ResponseMessage(
      'device-1',
      {
        version: '1.0',
        seq: 1,
        nonce: 1,
        timestamp: 1,
        protocol: Protocol.hello_response,
        isForProtocol: (p: Protocol) => p === Protocol.hello_response,
      },
      undefined,
    );

    const p = listener.waitFor(protocolVersion);

    // deliver the matching message
    await listener.onMessage(message);

    await expect(p).resolves.toBe(message);
  });

  it('rejects after timeout if no hello_response received', async () => {
    const nonMatching = new ResponseMessage(
      'device-1',
      {
        version: '1.0',
        seq: 2,
        nonce: 2,
        timestamp: 2,
        protocol: Protocol.ping_response,
        isForProtocol: (p: Protocol) => p === Protocol.ping_response,
      },
      undefined,
    );

    const p = listener.waitFor(protocolVersion);

    // deliver a non-matching message (should be ignored)
    await listener.onMessage(nonMatching);

    // advance timers to trigger the rejection (HELLO_RESPONSE_TIMEOUT_MS)
    vi.advanceTimersByTime(30000);

    await expect(p).rejects.toThrow(/no hello response/);
  });

  it('ignores messages when no handler is registered', () => {
    const message = new ResponseMessage(
      'device-1',
      {
        version: '1.0',
        seq: 3,
        nonce: 3,
        timestamp: 3,
        protocol: Protocol.hello_response,
        isForProtocol: (p: Protocol) => p === Protocol.hello_response,
      },
      undefined,
    );

    // call onMessage without waitFor() being called first
    expect(() => listener.onMessage(message)).not.toThrow();
  });
});

describe('HelloResponseListener (advanced behavior)', () => {
  const logger = createMockLogger();
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when hello_response message received', async () => {
    const listener = new HelloResponseListener(DUID, logger);
    const promise = listener.waitFor(protocolVersion);
    const msg = createMockMessage(true);
    // Simulate receiving the message before timeout
    listener.onMessage(msg);
    // Run all timers to ensure no pending
    vi.runAllTimers();
    await expect(promise).resolves.toBe(msg);
  });

  it('does not resolve for non-hello_response message', async () => {
    const listener = new HelloResponseListener(DUID, logger);
    const promise = listener.waitFor(protocolVersion);
    const msg = createMockMessage(false);
    listener.onMessage(msg);
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
    const listener = new HelloResponseListener(DUID, logger);
    const promise = listener.waitFor(protocolVersion);
    vi.advanceTimersByTime(HELLO_RESPONSE_TIMEOUT_MS);
    await expect(promise).rejects.toThrow(/no hello response/);
  });
});
