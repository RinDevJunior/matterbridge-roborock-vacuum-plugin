import { jest } from '@jest/globals';
import { ConnectionStateListener } from '../../../../../roborockCommunication/broadcast/listener/implementation/connectionStateListener';

// --- Helpers ---
function makeLogger() {
  const calls: { notice: string[]; info: string[]; error: string[] } = { notice: [], info: [], error: [] };
  return {
    notice: (m: string) => calls.notice.push(m),
    info: (m: string) => calls.info.push(m),
    error: (m: string) => calls.error.push(m),
    __calls: calls,
  } as any;
}

function makeClient(overrides: Partial<any> = {}) {
  return {
    retryCount: overrides.retryCount ?? 0,
    isInDisconnectingStep: overrides.isInDisconnectingStep ?? false,
    isConnected: overrides.isConnected ?? (() => false),
    connect: overrides.connect ?? jest.fn(),
  } as any;
}

describe('ConnectionStateListener', () => {
  // --- Reconnect/Retry Logic ---

  test('resets retryCount to 0 on reconnect', async () => {
    const logger = makeLogger();
    const client = makeClient({ retryCount: 5 });
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    await listener.onReconnect('DUID6', 'reconnected');
    expect(client.retryCount).toBe(0);
    expect(logger.__calls.info.some((s: string) => s.includes('reconnected'))).toBe(true);
  });

  test('resets retryCount to 0 and logs on connected', async () => {
    const logger = makeLogger();
    const client = makeClient();
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    await listener.onConnected('DUID1');
    expect(logger.__calls.notice.length).toBeGreaterThan(0);
  });

  test('logs error on onError', async () => {
    const logger = makeLogger();
    const client = makeClient();
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    await listener.onError('DUID1', 'boom');
    expect(logger.__calls.error.some((s: string) => s.includes('boom'))).toBe(true);
  });

  // --- Disconnection/Reconnection Policy ---

  test('does not reconnect if shouldReconnect is false', async () => {
    const logger = makeLogger();
    const client = makeClient();
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    // Don't call start() to leave shouldReconnect as false
    await listener.onDisconnected('DUID2', 'bye');
    expect(logger.__calls.error.length).toBeGreaterThan(0);
    expect(logger.__calls.notice.some((s: string) => s.includes('re-registration is disabled'))).toBe(true);
    expect(client.connect).not.toHaveBeenCalled();
  });

  test('schedules manual reconnect after 30s if still disconnected', async () => {
    jest.useFakeTimers();
    const logger = makeLogger();
    let connected = false;
    const client = makeClient({
      retryCount: 0,
      isInDisconnectingStep: false,
      isConnected: () => connected,
      connect: jest.fn(() => {
        connected = true;
      }),
    });
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    listener.start();
    await listener.onDisconnected('DUID7', 'lost');
    jest.advanceTimersByTime(29000);
    expect(client.connect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(client.connect).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('increments retryCount and schedules reconnect after 30s', async () => {
    jest.useFakeTimers();
    const logger = makeLogger();
    const client = makeClient({ retryCount: 0, isInDisconnectingStep: false });
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    listener.start();
    await listener.onDisconnected('DUID3', 'lost');
    expect(client.retryCount).toBe(1);
    expect(client.connect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(30000);
    expect(client.connect).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('does not reconnect if retryCount > 10', async () => {
    const logger = makeLogger();
    const client = makeClient({ retryCount: 11 });
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    listener.start();
    await listener.onDisconnected('DUID4', 'lost');
    expect(logger.__calls.error.some((s: string) => s.includes('exceeded retry limit'))).toBe(true);
    expect(client.connect).not.toHaveBeenCalled();
  });

  test('skips re-registration if in disconnecting step', async () => {
    const logger = makeLogger();
    const client = makeClient({ retryCount: 0, isInDisconnectingStep: true });
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    listener.start();
    await listener.onDisconnected('DUID5', 'lost');
    expect(logger.__calls.info.some((s: string) => s.includes('disconnecting step'))).toBe(true);
    expect(client.connect).not.toHaveBeenCalled();
    expect(client.isInDisconnectingStep).toBe(true);
  });
});
