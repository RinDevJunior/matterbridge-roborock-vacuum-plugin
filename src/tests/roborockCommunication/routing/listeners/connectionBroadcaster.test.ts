import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionBroadcaster } from '../../../../roborockCommunication/routing/listeners/connectionBroadcaster.js';
import { createMockLogger } from '../../../helpers/testUtils.js';
import type { AbstractConnectionListener } from '../../../../roborockCommunication/routing/listeners/abstractConnectionListener.js';

function createMockConnectionListener(): AbstractConnectionListener {
  return {
    onConnected: vi.fn().mockResolvedValue(undefined),
    onDisconnected: vi.fn().mockResolvedValue(undefined),
    onError: vi.fn().mockResolvedValue(undefined),
    onReconnect: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ConnectionBroadcaster', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let broadcaster: ConnectionBroadcaster;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createMockLogger();
    broadcaster = new ConnectionBroadcaster(logger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should log notice when registering a listener', () => {
      broadcaster.register(createMockConnectionListener());
      expect(logger.notice).toHaveBeenCalledWith('[ConnectionBroadcaster] register listener');
    });
  });

  describe('unregister', () => {
    it('should log notice when unregistering', () => {
      broadcaster.unregister();
      expect(logger.notice).toHaveBeenCalledWith('[ConnectionBroadcaster] unregister listener');
    });

    it('should clear all listeners so events are no longer broadcast', async () => {
      const listener = createMockConnectionListener();
      broadcaster.register(listener);
      broadcaster.unregister();

      await broadcaster.onConnected('duid-1');

      expect(listener.onConnected).not.toHaveBeenCalled();
    });
  });

  describe('onConnected', () => {
    it('should call onConnected on all registered listeners', async () => {
      const l1 = createMockConnectionListener();
      const l2 = createMockConnectionListener();
      broadcaster.register(l1);
      broadcaster.register(l2);

      await broadcaster.onConnected('duid-1');

      expect(l1.onConnected).toHaveBeenCalledWith('duid-1');
      expect(l2.onConnected).toHaveBeenCalledWith('duid-1');
    });

    it('should not throw when no listeners are registered', async () => {
      await expect(broadcaster.onConnected('duid-1')).resolves.toBeUndefined();
    });
  });

  describe('onDisconnected', () => {
    it('should call onDisconnected on all registered listeners', async () => {
      const listener = createMockConnectionListener();
      broadcaster.register(listener);

      await broadcaster.onDisconnected('duid-1', 'connection lost');

      expect(listener.onDisconnected).toHaveBeenCalledWith('duid-1', 'connection lost');
    });
  });

  describe('onError', () => {
    it('should call onError on all registered listeners', async () => {
      const listener = createMockConnectionListener();
      broadcaster.register(listener);

      await broadcaster.onError('duid-1', 'some error');

      expect(listener.onError).toHaveBeenCalledWith('duid-1', 'some error');
    });
  });

  describe('onReconnect', () => {
    it('should call onReconnect on all registered listeners', async () => {
      const listener = createMockConnectionListener();
      broadcaster.register(listener);

      await broadcaster.onReconnect('duid-1', 'reconnecting');

      expect(listener.onReconnect).toHaveBeenCalledWith('duid-1', 'reconnecting');
    });
  });
});
