import { ChainedConnectionListener } from '@/roborockCommunication/broadcast/listener/implementation/chainedConnectionListener.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ChainedConnectionListener', () => {
  let chained: ChainedConnectionListener;
  let listener1: any;
  let listener2: any;

  beforeEach(() => {
    chained = new ChainedConnectionListener();
    listener1 = {
      onConnected: vi.fn().mockResolvedValue(undefined),
      onDisconnected: vi.fn().mockResolvedValue(undefined),
      onError: vi.fn().mockResolvedValue(undefined),
    };
    listener2 = {
      onConnected: vi.fn().mockResolvedValue(undefined),
      onDisconnected: vi.fn().mockResolvedValue(undefined),
      onError: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('should register listeners', () => {
    chained.register(listener1);
    chained.register(listener2);

    // @ts-expect-error Accessing private property for testing
    expect(chained.listeners).toEqual([listener1, listener2]);
  });

  it('should call onConnected on all listeners', async () => {
    chained.register(listener1);
    chained.register(listener2);
    await chained.onConnected('test-duid');
    expect(listener1.onConnected).toHaveBeenCalled();
    expect(listener2.onConnected).toHaveBeenCalled();
  });

  it('should call onDisconnected on all listeners', async () => {
    chained.register(listener1);
    chained.register(listener2);
    await chained.onDisconnected('test-duid', 'disconnect message');
    expect(listener1.onDisconnected).toHaveBeenCalled();
    expect(listener2.onDisconnected).toHaveBeenCalled();
  });

  it('should call onError on all listeners with the same message', async () => {
    chained.register(listener1);
    chained.register(listener2);
    await chained.onError('test-duid', 'error message');
    expect(listener1.onError).toHaveBeenCalledWith('test-duid', 'error message');
    expect(listener2.onError).toHaveBeenCalledWith('test-duid', 'error message');
  });

  it('should work with no listeners registered', async () => {
    await expect(chained.onConnected('test-duid')).resolves.toBeUndefined();
    await expect(chained.onDisconnected('test-duid', 'disconnect message')).resolves.toBeUndefined();
    await expect(chained.onError('test-duid', 'error message')).resolves.toBeUndefined();
  });
});
