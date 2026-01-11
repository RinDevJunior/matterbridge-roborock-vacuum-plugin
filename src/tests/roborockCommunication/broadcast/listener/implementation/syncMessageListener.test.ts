import { SyncMessageListener } from '../../../../../roborockCommunication/broadcast/listener/implementation/syncMessageListener';
import { Protocol } from '../../../../../roborockCommunication/broadcast/model/protocol';
import { RequestMessage } from '../../../../../roborockCommunication/broadcast/model/requestMessage';

describe('SyncMessageListener', () => {
  let listener: SyncMessageListener;
  let logger: any;

  beforeEach(() => {
    logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() };
    listener = new SyncMessageListener(logger);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should call resolve and remove pending on rpc_response', async () => {
    const resolve = jest.fn();
    const reject = jest.fn();
    const messageId = 123;
    listener.waitFor(messageId, { method: 'test' } as RequestMessage, resolve, reject);

    const dps = { id: messageId, result: { foo: 'bar' } };
    const message = {
      contain: (proto: Protocol) => proto === Protocol.rpc_response,
      get: () => dps,
    } as any;

    await listener.onMessage(message);

    expect(resolve).toHaveBeenCalledWith(dps.result);
    expect(listener['pending'].has(messageId)).toBe(false);
  });

  it('should call resolve if result is ["ok"]', async () => {
    const resolve = jest.fn();
    const reject = jest.fn();
    const messageId = 456;
    listener.waitFor(messageId, { method: 'test' } as RequestMessage, resolve, reject);

    const dps = { id: messageId, result: ['ok'] };
    const message = {
      contain: (proto: Protocol) => proto === Protocol.rpc_response,
      get: () => dps,
    } as any;

    await listener.onMessage(message);

    expect(resolve).toHaveBeenCalled();
    expect(listener['pending'].has(messageId)).toBe(false);
  });

  it('should remove pending on map_response', async () => {
    const resolve = jest.fn();
    const reject = jest.fn();
    const messageId = 789;
    listener.waitFor(messageId, { method: 'test' } as RequestMessage, resolve, reject);

    const dps = { id: messageId };
    const message = {
      contain: (proto: Protocol) => proto === Protocol.map_response,
      get: () => dps,
    } as any;

    await listener.onMessage(message);

    expect(listener['pending'].has(messageId)).toBe(false);
  });

  it('should call reject after timeout if not resolved', () => {
    const resolve = jest.fn();
    const reject = jest.fn();
    const messageId = 321;
    listener.waitFor(messageId, { method: 'test' } as RequestMessage, resolve, reject);

    expect(listener['pending'].has(messageId)).toBe(true);

    jest.advanceTimersByTime(10000);

    expect(reject).toHaveBeenCalled();
    expect(listener['pending'].has(messageId)).toBe(false);
  });

  it('should not call resolve if no pending handler exists', async () => {
    const resolve = jest.fn();
    const messageId = 999;

    const dps = { id: messageId, result: { foo: 'bar' } };
    const message = {
      contain: (proto: Protocol) => proto === Protocol.rpc_response,
      get: () => dps,
    } as any;

    await listener.onMessage(message);

    expect(resolve).not.toHaveBeenCalled();
  });

  it('should handle messages that do not contain rpc_response or map_response', async () => {
    const message = {
      contain: () => false,
      get: () => null,
    } as any;

    await listener.onMessage(message);
    // Should complete without error
  });
});
