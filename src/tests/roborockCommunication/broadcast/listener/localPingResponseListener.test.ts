import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalPingResponseListener } from '../../../../roborockCommunication/local/localPingResponseListener.js';
import { Protocol, ResponseMessage, HeaderMessage } from '../../../../roborockCommunication/models/index.js';
import { asPartial } from '../../../helpers/testUtils.js';

function createMockLogger() {
  return {
    debug: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  };
}

describe('LocalPingResponseListener', () => {
  let listener: LocalPingResponseListener;
  let logger: ReturnType<typeof createMockLogger>;
  const duid = 'test-duid';

  beforeEach(() => {
    logger = createMockLogger();
    listener = new LocalPingResponseListener(duid, logger as any);
    vi.clearAllMocks();
  });

  it('should initialize with current timestamp as lastPingResponse', () => {
    const now = Date.now();
    expect(listener.lastPingResponse).toBeLessThanOrEqual(now);
    expect(listener.lastPingResponse).toBeGreaterThan(now - 1000);
  });

  it('should have correct name', () => {
    expect(listener.name).toBe('LocalPingResponseListener');
  });

  it('should have correct duid', () => {
    expect(listener.duid).toBe(duid);
  });

  it('should ignore messages for different duid', () => {
    const initialPingResponse = listener.lastPingResponse;
    const message = asPartial<ResponseMessage>({
      duid: 'other-duid',
      isForProtocol: vi.fn().mockReturnValue(true),
    });

    listener.onMessage(message);
    expect(listener.lastPingResponse).toBe(initialPingResponse);
  });

  it('should ignore messages that are not ping_response', () => {
    const initialPingResponse = listener.lastPingResponse;
    const message = asPartial<ResponseMessage>({
      duid,
      isForProtocol: vi.fn().mockReturnValue(false),
    });

    listener.onMessage(message);
    expect(listener.lastPingResponse).toBe(initialPingResponse);
  });

  it('should update lastPingResponse on ping_response message', () => {
    const oldTimestamp = listener.lastPingResponse - 10000;
    listener.lastPingResponse = oldTimestamp;

    const message = asPartial<ResponseMessage>({
      duid,
      isForProtocol: vi.fn((protocol: Protocol) => protocol === Protocol.ping_response),
    });

    listener.onMessage(message);
    expect(listener.lastPingResponse).toBeGreaterThan(oldTimestamp);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Received ping response message'));
  });

  it('should clear and unref timer on ping_response message when timer exists', () => {
    const mockTimer = {
      unref: vi.fn(),
    } as unknown as NodeJS.Timeout;
    listener['timer'] = mockTimer;

    vi.spyOn(global, 'clearTimeout');

    const message = asPartial<ResponseMessage>({
      duid,
      isForProtocol: vi.fn((protocol: Protocol) => protocol === Protocol.ping_response),
    });

    listener.onMessage(message);
    expect(clearTimeout).toHaveBeenCalledWith(mockTimer);
    expect(mockTimer.unref).toHaveBeenCalled();
  });

  it('should not throw when timer is undefined on ping_response message', () => {
    listener['timer'] = undefined;

    const message = asPartial<ResponseMessage>({
      duid,
      isForProtocol: vi.fn((protocol: Protocol) => protocol === Protocol.ping_response),
    });

    expect(() => listener.onMessage(message)).not.toThrow();
  });
});
