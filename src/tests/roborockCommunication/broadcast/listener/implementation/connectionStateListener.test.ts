import { ConnectionStateListener } from '@/roborockCommunication/broadcast/listener/implementation/connectionStateListener.js';
import { vi, describe, it, expect } from 'vitest';

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
    connect: overrides.connect ?? vi.fn(),
  } as any;
}

describe('ConnectionStateListener', () => {
  // --- Reconnect/Retry Logic ---

  it('resets retryCount to 0 on reconnect', async () => {
    const logger = makeLogger();
    const client = makeClient({ retryCount: 5 });
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    await listener.onReconnect('DUID6', 'reconnected');
    expect(client.retryCount).toBe(0);
    expect(logger.__calls.info.some((s: string) => s.includes('reconnected'))).toBe(true);
  });

  it('resets retryCount to 0 and logs on connected', async () => {
    const logger = makeLogger();
    const client = makeClient();
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    await listener.onConnected('DUID1');
    expect(logger.__calls.info.length).toBeGreaterThan(0);
  });

  it('logs error on onError', async () => {
    const logger = makeLogger();
    const client = makeClient();
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    await listener.onError('DUID1', 'boom');
    expect(logger.__calls.error.some((s: string) => s.includes('boom'))).toBe(true);
  });

  // --- Disconnection/Reconnection Policy ---

  it('does not reconnect if shouldReconnect is false', async () => {
    const logger = makeLogger();
    const client = makeClient();
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    // Don't call start() to leave shouldReconnect as false
    await listener.onDisconnected('DUID2', 'bye');
    expect(logger.__calls.error.length).toBeGreaterThan(0);
    expect(logger.__calls.notice.some((s: string) => s.includes('re-registration is disabled'))).toBe(true);
    expect(client.connect).not.toHaveBeenCalled();
  });

  it('schedules manual reconnect after 30s if still disconnected', async () => {
    vi.useFakeTimers();
    const logger = makeLogger();
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
    const logger = makeLogger();
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
    const logger = makeLogger();
    const client = makeClient({ retryCount: 11 });
    const listener = new ConnectionStateListener(logger, client, 'TEST');
    listener.start();
    await listener.onDisconnected('DUID4', 'lost');
    expect(logger.__calls.error.some((s: string) => s.includes('exceeded retry limit'))).toBe(true);
    expect(client.connect).not.toHaveBeenCalled();
  });

  it('skips re-registration if in disconnecting step', async () => {
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
