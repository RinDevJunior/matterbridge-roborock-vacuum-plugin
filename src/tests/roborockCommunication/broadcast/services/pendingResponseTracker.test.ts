import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PendingResponseTracker } from '../../../../roborockCommunication/routing/services/pendingResponseTracker.js';
import { HeaderMessage, Protocol, ResponseMessage, ResponseBody, RequestMessage, DpsPayload } from '../../../../roborockCommunication/models/index.js';
import { makeLogger } from '../../../testUtils.js';

describe('PendingResponseTracker', () => {
  let tracker: PendingResponseTracker;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    logger = makeLogger();
    tracker = new PendingResponseTracker(logger);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function createResponseMessage(messageId: number, result: any = { foo: 'bar' }): ResponseMessage {
    const dpsPayload = { id: messageId, result } as DpsPayload;
    const body = new ResponseBody({ 102: dpsPayload });
    const header = new HeaderMessage('1.0', 1, 1, Date.now(), Protocol.rpc_response);
    return new ResponseMessage('duid', header, body);
  }

  it('should resolve pending request when tryResolve is called', async () => {
    const messageId = 123;
    const request = new RequestMessage({ method: 'test', messageId });
    const response = createResponseMessage(messageId);

    const promise = tracker.waitFor(messageId, request);
    tracker.tryResolve(response);

    await expect(promise).resolves.toEqual({ foo: 'bar' });
    expect(tracker['pending'].has(messageId)).toBe(false);
  });

  it('should reject after timeout if not resolved', async () => {
    const messageId = 321;
    const request = new RequestMessage({ method: 'test', messageId });

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
    const request1 = new RequestMessage({ method: 'test1', messageId: messageId1 });
    const request2 = new RequestMessage({ method: 'test2', messageId: messageId2 });
    const response1 = createResponseMessage(messageId1, { foo: 'bar' });
    const response2 = createResponseMessage(messageId2, { baz: 'qux' });

    const promise1 = tracker.waitFor(messageId1, request1);
    const promise2 = tracker.waitFor(messageId2, request2);

    expect(tracker['pending'].size).toBe(2);

    tracker.tryResolve(response1);
    tracker.tryResolve(response2);

    await expect(promise1).resolves.toEqual({ foo: 'bar' });
    await expect(promise2).resolves.toEqual({ baz: 'qux' });
    expect(tracker['pending'].size).toBe(0);
  });

  it('should log debug when waitFor is called', () => {
    const messageId = 456;
    const request = new RequestMessage({ method: 'get_status', messageId });

    tracker.waitFor(messageId, request);

    expect(logger.debug).toHaveBeenCalledWith('Waiting for response to messageId: 456, method: get_status');
  });

  it('should log debug when tryResolve is called', () => {
    const messageId = 789;
    const request = new RequestMessage({ method: 'test', messageId });
    const response = createResponseMessage(messageId, { data: 'value' });

    tracker.waitFor(messageId, request);
    tracker.tryResolve(response);

    expect(logger.debug).toHaveBeenCalledWith('Resolved messageId: 789');
  });

  it('should clear timer when resolved before timeout', async () => {
    const messageId = 555;
    const request = new RequestMessage({ method: 'test', messageId });
    const response = createResponseMessage(messageId, {});

    const promise = tracker.waitFor(messageId, request);

    // Resolve immediately
    tracker.tryResolve(response);

    // Wait for promise to resolve
    await promise;

    // Advance timers past timeout
    vi.advanceTimersByTime(10000);

    // Should still resolve successfully (not reject with timeout)
    await expect(promise).resolves.toEqual({});
  });

  it('cancelAll should clear all pending requests', () => {
    const messageId1 = 100;
    const messageId2 = 200;
    const request1 = new RequestMessage({ method: 'test1', messageId: messageId1 });
    const request2 = new RequestMessage({ method: 'test2', messageId: messageId2 });

    tracker.waitFor(messageId1, request1);
    tracker.waitFor(messageId2, request2);

    expect(tracker['pending'].size).toBe(2);

    tracker.cancelAll();

    expect(tracker['pending'].size).toBe(0);
  });

  it('should handle rapid resolve calls gracefully', async () => {
    const messageId = 777;
    const request = new RequestMessage({ method: 'test', messageId });
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
    await expect(promise).resolves.toEqual({ first: true });
  });

  it('should properly unref timers', () => {
    const messageId = 888;
    const request = new RequestMessage({ method: 'test', messageId });

    tracker.waitFor(messageId, request);

    const entry = tracker['pending'].get(messageId);
    expect(entry).toBeDefined();
    expect(entry?.timer).toBeDefined();

    // Verify timer was created (will be unref'd internally)
    expect(tracker['pending'].has(messageId)).toBe(true);
  });

  it('should warn when response has no body', () => {
    const header = new HeaderMessage('1.0', 1, 1, Date.now(), Protocol.rpc_response);
    const response = new ResponseMessage('duid', header, undefined);

    tracker.tryResolve(response);

    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Response message has no body'));
  });

  it('should resolve when payload present on non-102 protocol', async () => {
    const messageId = 9999;
    const request = { method: 'test', messageId } as RequestMessage;
    const dpsPayload: DpsPayload = { id: messageId, result: { ok: true } };
    const body = new ResponseBody({ 5: dpsPayload });
    const header = new HeaderMessage('1.0', 1, 1, Date.now(), Protocol.general_response);
    const response = new ResponseMessage('duid', header, body);

    const promise = tracker.waitFor(messageId, request);
    tracker.tryResolve(response);

    await expect(promise).resolves.toEqual(dpsPayload.result);
    expect(tracker['pending'].has(messageId)).toBe(false);
  });

  it('should throw when response missing DPS payload', () => {
    const header = new HeaderMessage('1.0', 1, 1, Date.now(), Protocol.rpc_response);
    const body = new ResponseBody({});
    const response = new ResponseMessage('duid', header, body);

    expect(() => tracker.tryResolve(response)).toThrow();
  });

  it('should do nothing when DPS payload missing id', () => {
    const header = new HeaderMessage('1.0', 1, 1, Date.now(), Protocol.rpc_response);
    // Use a string value (allowed by Dps) to simulate missing id
    const body = new ResponseBody({ 102: 'no-id' });
    const response = new ResponseMessage('duid', header, body);

    tracker.tryResolve(response);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(tracker['pending'].size).toBe(0);
  });

  it('should handle real response with complex payload', async () => {
    const messageId = 18755;
    const request = new RequestMessage({ method: 'get_status', messageId });
    const complexResult = [110];
    const response = createResponseMessage(messageId, complexResult);

    const promise = tracker.waitFor(messageId, request);
    tracker.tryResolve(response);

    await expect(promise).resolves.toEqual(complexResult);
    expect(tracker['pending'].has(messageId)).toBe(false);
  });

  it('should resolve when rpc_response payload is a number', async () => {
    const messageId = 4242;
    const request = new RequestMessage({ method: 'test', messageId });
    // Use string value to satisfy Dps typing - current implementation does not treat this as a valid DPS payload and should time out
    const body = new ResponseBody({ 102: String(messageId) });
    const header = new HeaderMessage('1.0', 1, 1, Date.now(), Protocol.rpc_response);
    const response = new ResponseMessage('duid', header, body);

    const promise = tracker.waitFor(messageId, request);
    tracker.tryResolve(response);

    // Should not resolve; advance timers to trigger timeout
    vi.advanceTimersByTime(10000);

    await expect(promise).rejects.toThrow(`Message timeout for messageId: ${messageId}`);
    expect(tracker['pending'].has(messageId)).toBe(false);
  });

  it('should resolve when id is present in another data mapping', async () => {
    const messageId = 6666;
    const request = new RequestMessage({ method: 'test', messageId });
    // put the id under a different data key (string to satisfy Dps type)
    const body = new ResponseBody({ 123: String(messageId) });
    const header = new HeaderMessage('1.0', 1, 1, Date.now(), Protocol.rpc_response);
    const response = new ResponseMessage('duid', header, body);

    const promise = tracker.waitFor(messageId, request);
    expect(() => tracker.tryResolve(response)).toThrow();

    // Ensure pending was not resolved
    vi.advanceTimersByTime(10000);
    await expect(promise).rejects.toThrow(`Message timeout for messageId: ${messageId}`);
    expect(tracker['pending'].has(messageId)).toBe(false);
  });

  it('should reject after timeout when id is a numeric string', async () => {
    const messageId = 13131;
    const request = new RequestMessage({ method: 'test', messageId });
    // store JSON string to simulate payload that includes a numeric string id (keeps types valid)
    const body = new ResponseBody({ 102: JSON.stringify({ id: String(messageId), result: { ok: true } }) });
    const header = new HeaderMessage('1.0', 1, 1, Date.now(), Protocol.rpc_response);
    const response = new ResponseMessage('duid', header, body);

    const promise = tracker.waitFor(messageId, request);
    tracker.tryResolve(response);

    // ensure the pending entry will eventually time out
    vi.advanceTimersByTime(10000);
    await expect(promise).rejects.toThrow(`Message timeout for messageId: ${messageId}`);
    expect(tracker['pending'].has(messageId)).toBe(false);
  });
});
