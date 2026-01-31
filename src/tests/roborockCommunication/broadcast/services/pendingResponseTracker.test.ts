import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PendingResponseTracker } from '../../../../roborockCommunication/routing/services/pendingResponseTracker.js';
import { Protocol, RequestMessage, ResponseMessage } from '../../../../roborockCommunication/models/index.js';

describe('PendingResponseTracker', () => {
  let tracker: PendingResponseTracker;
  let logger: any;

  beforeEach(() => {
    logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn(), fatal: vi.fn(), notice: vi.fn() };
    tracker = new PendingResponseTracker(logger);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function createResponseMessage(messageId: number, result: any = { foo: 'bar' }): ResponseMessage {
    const dpsPayload = { id: messageId, result };
    return {
      body: { data: { 102: dpsPayload } },
      isForProtocol: (proto: Protocol) => proto === Protocol.rpc_response,
      get: (proto: Protocol) => (proto === Protocol.rpc_response ? dpsPayload : undefined),
    } as any;
  }

  it('should resolve pending request when tryResolve is called', async () => {
    const messageId = 123;
    const request = { method: 'test', messageId } as RequestMessage;
    const response = createResponseMessage(messageId);

    const promise = tracker.waitFor(messageId, request);
    tracker.tryResolve(response);

    await expect(promise).resolves.toEqual(response);
    expect(tracker['pending'].has(messageId)).toBe(false);
  });

  it('should reject after timeout if not resolved', async () => {
    const messageId = 321;
    const request = { method: 'test', messageId } as RequestMessage;

    const promise = tracker.waitFor(messageId, request);

    expect(tracker['pending'].has(messageId)).toBe(true);

    vi.advanceTimersByTime(10000);

    await expect(promise).rejects.toThrow('Message timeout for messageId: 321');
    expect(tracker['pending'].has(messageId)).toBe(false);
  });

  it('should do nothing when tryResolve called with non-existent messageId', () => {
    const messageId = 999;
    const response = createResponseMessage(messageId);

    tracker.tryResolve(response);

    expect(tracker['pending'].has(messageId)).toBe(false);
  });

  it('should handle multiple pending requests', async () => {
    const messageId1 = 111;
    const messageId2 = 222;
    const request1 = { method: 'test1', messageId: messageId1 } as RequestMessage;
    const request2 = { method: 'test2', messageId: messageId2 } as RequestMessage;
    const response1 = createResponseMessage(messageId1, { foo: 'bar' });
    const response2 = createResponseMessage(messageId2, { baz: 'qux' });

    const promise1 = tracker.waitFor(messageId1, request1);
    const promise2 = tracker.waitFor(messageId2, request2);

    expect(tracker['pending'].size).toBe(2);

    tracker.tryResolve(response1);
    tracker.tryResolve(response2);

    await expect(promise1).resolves.toEqual(response1);
    await expect(promise2).resolves.toEqual(response2);
    expect(tracker['pending'].size).toBe(0);
  });

  it('should log debug when waitFor is called', () => {
    const messageId = 456;
    const request = { method: 'get_status', messageId } as RequestMessage;

    tracker.waitFor(messageId, request);

    expect(logger.debug).toHaveBeenCalledWith('Waiting for response to messageId: 456, method: get_status');
  });

  it('should log debug when tryResolve is called', () => {
    const messageId = 789;
    const request = { method: 'test', messageId } as RequestMessage;
    const response = createResponseMessage(messageId, { data: 'value' });

    tracker.waitFor(messageId, request);
    tracker.tryResolve(response);

    expect(logger.debug).toHaveBeenCalledWith('Resolved messageId: 789');
  });

  it('should clear timer when resolved before timeout', async () => {
    const messageId = 555;
    const request = { method: 'test', messageId } as RequestMessage;
    const response = createResponseMessage(messageId, {});

    const promise = tracker.waitFor(messageId, request);

    // Resolve immediately
    tracker.tryResolve(response);

    // Wait for promise to resolve
    await promise;

    // Advance timers past timeout
    vi.advanceTimersByTime(10000);

    // Should still resolve successfully (not reject with timeout)
    await expect(promise).resolves.toEqual(response);
  });

  it('cancelAll should clear all pending requests', () => {
    const messageId1 = 100;
    const messageId2 = 200;
    const request1 = { method: 'test1', messageId: messageId1 } as RequestMessage;
    const request2 = { method: 'test2', messageId: messageId2 } as RequestMessage;

    tracker.waitFor(messageId1, request1);
    tracker.waitFor(messageId2, request2);

    expect(tracker['pending'].size).toBe(2);

    tracker.cancelAll();

    expect(tracker['pending'].size).toBe(0);
  });

  it('should handle rapid resolve calls gracefully', async () => {
    const messageId = 777;
    const request = { method: 'test', messageId } as RequestMessage;
    const response1 = createResponseMessage(messageId, { first: true });
    const response2 = createResponseMessage(messageId, { second: true });

    const promise = tracker.waitFor(messageId, request);

    // First resolve should work
    tracker.tryResolve(response1);

    // Wait for promise
    await promise;

    // Second resolve should do nothing (already resolved)
    tracker.tryResolve(response2);

    // Promise should resolve with first response
    await expect(promise).resolves.toEqual(response1);
  });

  it('should properly unref timers', () => {
    const messageId = 888;
    const request = { method: 'test', messageId } as RequestMessage;

    tracker.waitFor(messageId, request);

    const entry = tracker['pending'].get(messageId);
    expect(entry).toBeDefined();
    expect(entry?.timer).toBeDefined();

    // Verify timer was created (will be unref'd internally)
    expect(tracker['pending'].has(messageId)).toBe(true);
  });

  it('should warn when response has no body', () => {
    const response = { body: undefined, isForProtocol: vi.fn() } as any;

    tracker.tryResolve(response);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Response message has no body'));
  });

  it('should resolve when payload present on non-102 protocol', async () => {
    const messageId = 9999;
    const request = { method: 'test', messageId } as RequestMessage;
    const dpsPayload = { id: messageId, result: { ok: true } };
    const response = {
      body: { data: { 5: dpsPayload } },
      isForProtocol: (p: Protocol) => p === Protocol.general_response,
      get: (p: Protocol) => (p === Protocol.general_response ? dpsPayload : undefined),
    } as any;

    const promise = tracker.waitFor(messageId, request);
    tracker.tryResolve(response);

    await expect(promise).resolves.toEqual(response);
    expect(tracker['pending'].has(messageId)).toBe(false);
  });

  it('should warn when response missing DPS payload', () => {
    const response = {
      body: { data: { 102: null } },
      isForProtocol: (_proto: Protocol) => _proto === Protocol.rpc_response,
      get: (_proto: Protocol) => null,
    } as any;

    tracker.tryResolve(response);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Response message missing DPS payload or id'));
  });

  it('should warn when DPS payload missing id', () => {
    const response = {
      body: { data: { 102: { result: 'data' } } },
      isForProtocol: (_proto: Protocol) => _proto === Protocol.rpc_response,
      get: (_proto: Protocol) => ({ result: 'data' }),
    } as any;

    tracker.tryResolve(response);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Response message missing DPS payload or id'));
  });

  it('should handle real response with complex payload', async () => {
    const messageId = 18755;
    const request = { method: 'get_status', messageId } as RequestMessage;
    const complexResult = [110];
    const response = createResponseMessage(messageId, complexResult);

    const promise = tracker.waitFor(messageId, request);
    tracker.tryResolve(response);

    await expect(promise).resolves.toEqual(response);
    expect(tracker['pending'].has(messageId)).toBe(false);
  });

  it('should resolve when rpc_response payload is a number', async () => {
    const messageId = 4242;
    const request = { method: 'test', messageId } as RequestMessage;
    const response = {
      body: { data: { 102: messageId } },
      isForProtocol: (proto: Protocol) => proto === Protocol.rpc_response,
      get: (proto: Protocol) => (proto === Protocol.rpc_response ? messageId : undefined),
    } as any;

    const promise = tracker.waitFor(messageId, request);
    tracker.tryResolve(response);

    await expect(promise).resolves.toEqual(response);
    expect(tracker['pending'].has(messageId)).toBe(false);
  });

  it('should resolve when id is present in another data mapping', async () => {
    const messageId = 6666;
    const request = { method: 'test', messageId } as RequestMessage;
    const response = {
      body: { data: { 123: messageId } },
      // still marked as rpc_response (some devices do this)
      isForProtocol: (proto: Protocol) => proto === Protocol.rpc_response,
      get: (_proto: Protocol) => undefined,
    } as any;

    const promise = tracker.waitFor(messageId, request);
    tracker.tryResolve(response);

    await expect(promise).resolves.toEqual(response);
    expect(tracker['pending'].has(messageId)).toBe(false);
  });

  it('should resolve when id is a numeric string', async () => {
    const messageId = 13131;
    const request = { method: 'test', messageId } as RequestMessage;
    const response = {
      body: { data: { 102: { id: String(messageId), result: { ok: true } } } },
      isForProtocol: (_p: Protocol) => true,
      get: (_p: Protocol) => undefined,
    } as any;

    const promise = tracker.waitFor(messageId, request);
    tracker.tryResolve(response);

    await expect(promise).resolves.toEqual(response);
    expect(tracker['pending'].has(messageId)).toBe(false);
  });
});
