import { vi, describe, it, expect } from 'vitest';
import { ConnectionStateListener } from '../../../../../roborockCommunication/routing/listeners/implementation/connectionStateListener.js';
import { createMockLogger, asPartial, asType } from '../../../../testUtils.js';
import { AbstractClient } from '../../../../../roborockCommunication/routing/abstractClient.js';

function makeClient(overrides: Partial<AbstractClient> = {}) {
  return asPartial<AbstractClient>({
    retryCount: overrides['retryCount'] ?? 0,
    isInDisconnectingStep: overrides['isInDisconnectingStep'] ?? false,
    isConnected: vi.fn(() => (overrides['isConnected'] ? overrides['isConnected']() : false)),
    connect: vi.fn(() => (overrides['connect'] as unknown) ?? vi.fn()()),
  });
}

describe('ConnectionStateListener', () => {
  // --- Reconnect/Retry Logic ---

  it('resets retryCount to 0 on reconnect', async () => {
    const logger = createMockLogger();
    const client = makeClient({ retryCount: 5 });
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    await listener.onReconnect('DUID6', 'reconnected');
    expect(client.retryCount).toBe(0);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('reconnected'));
  });

  it('resets retryCount to 0 and logs on connected', async () => {
    const logger = createMockLogger();
    const client = makeClient();
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    await listener.onConnected('DUID1');
    expect(logger.info).toHaveBeenCalled();
  });

  it('logs error on onError', async () => {
    const logger = createMockLogger();
    const client = makeClient();
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    await listener.onError('DUID1', 'boom');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });

  // --- Disconnection/Reconnection Policy ---

  it('does not reconnect if shouldReconnect is false', async () => {
    const logger = createMockLogger();
    const client = makeClient();
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    // Don't call start() to leave shouldReconnect as false
    await listener.onDisconnected('DUID2', 'bye');
    expect(logger.error).toHaveBeenCalled();
    expect(logger.notice).toHaveBeenCalledWith(expect.stringContaining('re-registration is disabled'));
    expect(client.connect).not.toHaveBeenCalled();
  });

  it('schedules manual reconnect after 30s if still disconnected', async () => {
    vi.useFakeTimers();
    const logger = createMockLogger();
    let connected = false;
    const client = makeClient({
      retryCount: 0,
      isInDisconnectingStep: false,
      isConnected: () => connected,
      connect: vi.fn(() => {
        connected = true;
      }),
    });
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    listener.start();
    await listener.onDisconnected('DUID7', 'lost');
    vi.advanceTimersByTime(29000);
    expect(client.connect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(client.connect).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('increments retryCount and schedules reconnect after 30s', async () => {
    vi.useFakeTimers();
    const logger = createMockLogger();
    const client = makeClient({ retryCount: 0, isInDisconnectingStep: false });
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    listener.start();
    await listener.onDisconnected('DUID3', 'lost');
    expect(client.retryCount).toBe(1);
    expect(client.connect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30000);
    expect(client.connect).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not reconnect if retryCount > 10', async () => {
    const logger = createMockLogger();
    const client = makeClient({ retryCount: 11 });
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    listener.start();
    await listener.onDisconnected('DUID4', 'lost');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('exceeded retry limit'));

    expect(client.connect).not.toHaveBeenCalled();
  });

  it('skips re-registration if in disconnecting step', async () => {
    const logger = createMockLogger();
    const client = makeClient({ retryCount: 0, isInDisconnectingStep: true });
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    listener.start();
    await listener.onDisconnected('DUID5', 'lost');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('disconnecting step'));
    expect(client.connect).not.toHaveBeenCalled();
    expect(client.isInDisconnectingStep).toBe(true);
  });
});
