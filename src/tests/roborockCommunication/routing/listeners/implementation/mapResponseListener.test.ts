import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapResponseListener } from '../../../../../roborockCommunication/routing/listeners/implementation/mapResponseListener.js';

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    log: vi.fn(),
  };
}

describe('MapResponseListener', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let listener: MapResponseListener;
  let duid: string;

  beforeEach(() => {
    duid = 'test-duid';
    logger = createMockLogger();
    listener = new MapResponseListener(duid, logger as any);
  });

  it('should construct with duid and logger', () => {
    expect(listener).toBeInstanceOf(MapResponseListener);
  });

  it('should log debug if message is for Protocol.map_response', async () => {
    const message = {
      isForProtocol: vi.fn().mockReturnValue(true),
    } as any;
    await listener.onMessage(message);
    expect(message.isForProtocol).toHaveBeenCalledWith(expect.anything());
    expect(logger.debug).toHaveBeenCalled();
  });

  it('should not log if message is not for Protocol.map_response', async () => {
    const message = {
      isForProtocol: vi.fn().mockReturnValue(false),
    } as any;
    await listener.onMessage(message);
    expect(logger.debug).not.toHaveBeenCalled();
  });
});
