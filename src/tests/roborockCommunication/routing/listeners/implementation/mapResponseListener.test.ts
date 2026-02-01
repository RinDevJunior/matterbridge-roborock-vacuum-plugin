import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapResponseListener } from '../../../../../roborockCommunication/routing/listeners/implementation/mapResponseListener.js';
import { asType, asPartial } from '../../../../testUtils.js';
import { ResponseMessage } from '../../../../../roborockCommunication/models/index.js';

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
    listener = new MapResponseListener(duid, asType(logger));
  });

  it('should construct with duid and logger', () => {
    expect(listener).toBeInstanceOf(MapResponseListener);
  });

  it('should log debug if message is for Protocol.map_response', async () => {
    const message = asPartial<ResponseMessage>({
      isForProtocol: vi.fn().mockReturnValue(true),
    });
    await listener.onMessage(message);
    expect(message.isForProtocol).toHaveBeenCalledWith(expect.anything());
    expect(logger.debug).toHaveBeenCalled();
  });

  it('should not log if message is not for Protocol.map_response', async () => {
    const message = asPartial<ResponseMessage>({
      isForProtocol: vi.fn().mockReturnValue(false),
    });
    await listener.onMessage(message);
    expect(logger.debug).not.toHaveBeenCalled();
  });
});
