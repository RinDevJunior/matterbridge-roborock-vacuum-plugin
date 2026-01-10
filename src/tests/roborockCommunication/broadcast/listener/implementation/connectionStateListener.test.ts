import { jest } from '@jest/globals';

import { ConnectionStateListener } from '../../../../../roborockCommunication/broadcast/listener/implementation/connectionStateListener';

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
    connect: jest.fn(),
  } as any;
}

describe('ConnectionStateListener', () => {
  test('onConnected and onError log appropriately', async () => {
    const logger = makeLogger();
    const client = makeClient();
    const listener = new ConnectionStateListener(logger, client, 'TEST');

    await listener.onConnected('DUID1');
    expect(logger.__calls.notice.length).toBeGreaterThan(0);

    await listener.onError('DUID1', 'boom');
    expect(logger.__calls.error.some((s) => s.includes('boom'))).toBe(true);
  });

  test('onDisconnected without reconnect does not call connect', async () => {
    const logger = makeLogger();
    const client = makeClient();
    const listener = new ConnectionStateListener(logger, client, 'TEST', false);

    await listener.onDisconnected('DUID2', 'bye');
    expect(logger.__calls.error.length).toBeGreaterThan(0);
    expect(logger.__calls.notice.some((s) => s.includes('re-registration is disabled'))).toBe(true);
    expect(client.connect).not.toHaveBeenCalled();
  });

  test('onDisconnected with reconnect schedules connect and increments retryCount', async () => {
    jest.useFakeTimers();
    const logger = makeLogger();
    const client = makeClient({ retryCount: 0, isInDisconnectingStep: false });
    const listener = new ConnectionStateListener(logger, client, 'TEST', true);

    await listener.onDisconnected('DUID3', 'lost');
    expect(client.retryCount).toBe(1);
    // connect is scheduled after 10000ms
    expect(client.connect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(10000);
    expect(client.connect).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('onDisconnected with retryCount > 10 does not reconnect', async () => {
    const logger = makeLogger();
    const client = makeClient({ retryCount: 11 });
    const listener = new ConnectionStateListener(logger, client, 'TEST', true);

    await listener.onDisconnected('DUID4', 'lost');
    expect(logger.__calls.error.some((s) => s.includes('exceeded retry limit'))).toBe(true);
    expect(client.connect).not.toHaveBeenCalled();
  });

  test('onDisconnected when in disconnecting step skips re-registration', async () => {
    const logger = makeLogger();
    const client = makeClient({ retryCount: 0, isInDisconnectingStep: true });
    const listener = new ConnectionStateListener(logger, client, 'TEST', true);

    await listener.onDisconnected('DUID5', 'lost');
    expect(logger.__calls.info.some((s) => s.includes('disconnecting step'))).toBe(true);
    expect(client.connect).not.toHaveBeenCalled();
    // isInDisconnectingStep should remain true because the early-return path was taken
    expect(client.isInDisconnectingStep).toBe(true);
  });
});
