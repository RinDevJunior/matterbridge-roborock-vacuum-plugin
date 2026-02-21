import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { B01ResponseBroadcaster } from '../../../../roborockCommunication/routing/listeners/b01ResponseBroadcaster.js';
import { B01PendingResponseTracker } from '../../../../roborockCommunication/routing/services/b01PendingResponseTracker.js';
import { HeaderMessage, ResponseBody, ResponseMessage } from '../../../../roborockCommunication/models/index.js';
import { createMockLogger, asType } from '../../../helpers/testUtils.js';
import { AnsiLogger } from 'matterbridge/logger';
import { AbstractMessageListener } from '../../../../roborockCommunication/routing/listeners/abstractMessageListener.js';

function makeResponse(duid = 'test-duid'): ResponseMessage {
  const header = new HeaderMessage('B01', 1, 0, 101, 102);
  const body = new ResponseBody({ '101': { '108': 4 } });
  return new ResponseMessage(duid, header, body);
}

describe('B01ResponseBroadcaster', () => {
  let logger: AnsiLogger;
  let tracker: B01PendingResponseTracker;
  let broadcaster: B01ResponseBroadcaster;

  beforeEach(() => {
    logger = createMockLogger();
    tracker = new B01PendingResponseTracker(logger, 500, 1);
    broadcaster = new B01ResponseBroadcaster(tracker, logger);
  });

  afterEach(() => {
    broadcaster.unregister();
    vi.clearAllMocks();
  });

  it('should dispatch message to all registered listeners', () => {
    const listener1: AbstractMessageListener = { name: 'Listener1', duid: 'test-duid', onMessage: vi.fn() };
    const listener2: AbstractMessageListener = { name: 'Listener2', duid: 'test-duid', onMessage: vi.fn() };

    broadcaster.register(listener1);
    broadcaster.register(listener2);

    const response = makeResponse();
    broadcaster.onMessage(response);

    expect(listener1.onMessage).toHaveBeenCalledWith(response);
    expect(listener2.onMessage).toHaveBeenCalledWith(response);
  });

  it('should catch errors from listeners and continue dispatching', () => {
    const failingListener: AbstractMessageListener = {
      name: 'FailListener',
      duid: 'test-duid',
      onMessage: vi.fn(() => {
        throw new Error('listener error');
      }),
    };
    const goodListener: AbstractMessageListener = { name: 'GoodListener', duid: 'test-duid', onMessage: vi.fn() };

    broadcaster.register(failingListener);
    broadcaster.register(goodListener);

    const response = makeResponse();
    broadcaster.onMessage(response);

    expect(goodListener.onMessage).toHaveBeenCalledWith(response);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should forward tryResolve to tracker', () => {
    const spy = vi.spyOn(tracker, 'tryResolve');
    const response = makeResponse();

    broadcaster.tryResolve(response);

    expect(spy).toHaveBeenCalledWith(response);
  });

  it('should clear listeners and cancel tracker on unregister', () => {
    const spy = vi.spyOn(tracker, 'cancelAll');
    const listener: AbstractMessageListener = { name: 'L', duid: 'test-duid', onMessage: vi.fn() };

    broadcaster.register(listener);
    broadcaster.unregister();

    const response = makeResponse();
    broadcaster.onMessage(response);

    expect(listener.onMessage).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });

  it('should delegate waitFor to tracker and reject on cancel', async () => {
    vi.useFakeTimers();
    const { RequestMessage } = await import('../../../../roborockCommunication/models/index.js');
    const request = new RequestMessage({ timestamp: 100, protocol: 101, messageId: 1234, nonce: 5678 });
    const promise = broadcaster.waitFor(request, 'test-duid');

    tracker.cancelAll();
    await expect(promise).rejects.toThrow();
    vi.useRealTimers();
  });
});
