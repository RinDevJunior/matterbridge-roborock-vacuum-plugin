import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { V1ResponseBroadcaster } from '../../../../roborockCommunication/routing/listeners/v1ResponseBroadcaster.js';
import { V1PendingResponseTracker } from '../../../../roborockCommunication/routing/services/v1PendingResponseTracker.js';
import { HeaderMessage, ResponseBody, ResponseMessage } from '../../../../roborockCommunication/models/index.js';
import { createMockLogger } from '../../../helpers/testUtils.js';
import { AnsiLogger } from 'matterbridge/logger';
import { AbstractMessageListener } from '../../../../roborockCommunication/routing/listeners/abstractMessageListener.js';

function makeResponse(duid = 'test-duid'): ResponseMessage {
  const header = new HeaderMessage('1.0', 1, 0, 101, 102);
  const body = new ResponseBody({ '102': { id: 123, result: ['ok'] } });
  return new ResponseMessage(duid, header, body);
}

describe('V1ResponseBroadcaster', () => {
  let logger: AnsiLogger;
  let tracker: V1PendingResponseTracker;
  let broadcaster: V1ResponseBroadcaster;

  beforeEach(() => {
    vi.useFakeTimers();
    logger = createMockLogger();
    tracker = new V1PendingResponseTracker(logger);
    broadcaster = new V1ResponseBroadcaster(tracker, logger);
  });

  afterEach(() => {
    broadcaster.unregister();
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should have name ResponseBroadcaster', () => {
    expect(broadcaster.name).toBe('ResponseBroadcaster');
  });

  it('should dispatch message to all registered listeners', () => {
    const listener1: AbstractMessageListener = { name: 'Listener1', duid: 'test', onMessage: vi.fn() };
    const listener2: AbstractMessageListener = { name: 'Listener2', duid: 'test', onMessage: vi.fn() };

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
      duid: 'test',
      onMessage: vi.fn(() => {
        throw new Error('listener error');
      }),
    };
    const goodListener: AbstractMessageListener = { name: 'GoodListener', duid: 'test', onMessage: vi.fn() };

    broadcaster.register(failingListener);
    broadcaster.register(goodListener);

    const response = makeResponse();
    broadcaster.onMessage(response);

    expect(goodListener.onMessage).toHaveBeenCalledWith(response);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should catch non-Error exceptions and log them', () => {
    const failingListener: AbstractMessageListener = {
      name: 'FailListener',
      duid: 'test',
      onMessage: vi.fn(() => {
        throw 'string error';
      }),
    };

    broadcaster.register(failingListener);
    broadcaster.onMessage(makeResponse());

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('string error'));
  });

  it('should forward tryResolve to tracker', () => {
    const spy = vi.spyOn(tracker, 'tryResolve');
    const response = makeResponse();

    broadcaster.tryResolve(response);

    expect(spy).toHaveBeenCalledWith(response);
  });

  it('should clear listeners and cancel tracker on unregister', () => {
    const spy = vi.spyOn(tracker, 'cancelAll');
    const listener: AbstractMessageListener = { name: 'L', duid: 'test', onMessage: vi.fn() };

    broadcaster.register(listener);
    broadcaster.unregister();

    const response = makeResponse();
    broadcaster.onMessage(response);

    expect(listener.onMessage).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });

  it('should dispatch to no listeners when none registered', () => {
    const response = makeResponse();
    broadcaster.onMessage(response);

    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('0 listeners'));
  });
});
