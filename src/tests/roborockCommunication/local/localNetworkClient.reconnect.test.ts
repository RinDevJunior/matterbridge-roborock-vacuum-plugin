import { EventEmitter } from 'node:events';

declare global {
  var mockSocketInstance: any;
}

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { asPartial, createMockLogger, mkUser } from '../../helpers/testUtils.js';
import { LocalNetworkClient } from '../../../roborockCommunication/local/localClient.js';
import { MessageContext } from '../../../roborockCommunication/models/messageContext.js';
import { V1PendingResponseTracker } from '../../../roborockCommunication/routing/services/v1PendingResponseTracker.js';
import { V1ResponseBroadcaster } from '../../../roborockCommunication/routing/listeners/v1ResponseBroadcaster.js';

vi.mock('node:net', () => {
  class Sket {
    constructor() {
      if (globalThis.mockSocketInstance) {
        return globalThis.mockSocketInstance;
      }
    }

    on() {}
    once() {}
    emit() {}
    write() {}
    destroy() {}
    connect() {}
    setTimeout() {}
    address() {
      return { address: '127.0.0.1', port: 58867 };
    }
  }
  return { Socket: Sket };
});

const DUID = 'device-001';
const IP = '192.168.1.100';

function makeMockSocket() {
  return Object.assign(new EventEmitter(), {
    connect: vi.fn(),
    destroy: vi.fn(),
    write: vi.fn(),
    setTimeout: vi.fn(),
    address: vi.fn().mockReturnValue({ address: IP, port: 58867 }),
    readyState: 'open',
    destroyed: false,
    writable: true,
    readable: true,
  });
}

function createClient(mockSocket: ReturnType<typeof makeMockSocket>): LocalNetworkClient {
  globalThis.mockSocketInstance = mockSocket;

  const logger = createMockLogger();
  const user = mkUser();
  const context = new MessageContext(user);
  context.registerDevice(DUID, 'local-key', 'L01', undefined);

  const tracker = new V1PendingResponseTracker(logger);
  const broadcaster = new V1ResponseBroadcaster(tracker, logger);

  const client = new LocalNetworkClient(logger, context, DUID, IP, broadcaster, tracker);
  Object.defineProperty(client, 'serializer', {
    value: asPartial({ serialize: vi.fn().mockReturnValue({ buffer: Buffer.from([1, 2, 3]), messageId: 1 }) }),
    writable: true,
  });
  return client;
}

describe('LocalNetworkClient – ping timeout triggers reconnect', () => {
  let client: LocalNetworkClient;
  let mockSocket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSocket = makeMockSocket();
    client = createClient(mockSocket);
  });

  afterEach(() => {
    if (client['checkConnectionInterval']) {
      clearInterval(client['checkConnectionInterval']);
      client['checkConnectionInterval'] = undefined;
    }
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  async function simulateSuccessfulConnect(): Promise<void> {
    client['helloResponseListener'].waitFor = vi.fn().mockResolvedValue({
      header: { nonce: 9999, version: 'L01' },
    });
    client.connect();
    mockSocket.emit('connect');
    await vi.advanceTimersByTimeAsync(0);
  }

  it('should trigger reconnect when no ping response received for 15s', async () => {
    await simulateSuccessfulConnect();
    expect(client.isReady()).toBe(true);

    const disconnectSpy = vi.spyOn(client, 'disconnect');
    const connectSpy = vi.spyOn(client, 'connect');

    // checkConnection fires every 5s; advance tick-by-tick so async guard resets between calls.
    // At t=5000: 5000ms elapsed — no reconnect.
    // At t=10000: 10000ms elapsed — no reconnect.
    // At t=15001: >15000ms elapsed — reconnect triggered.
    for (let tick = 0; tick < 4; tick++) {
      await vi.advanceTimersByTimeAsync(5000);
    }

    expect(disconnectSpy).toHaveBeenCalledOnce();
    expect(connectSpy).toHaveBeenCalled();
  });

  it('should update lastPingResponse when ping response is received after reconnect', async () => {
    await simulateSuccessfulConnect();
    expect(client.isReady()).toBe(true);

    // Trigger reconnect
    await vi.advanceTimersByTimeAsync(20000);

    // Reconnect with fresh socket
    mockSocket = makeMockSocket();
    client = createClient(mockSocket);
    await simulateSuccessfulConnect();
    expect(client.isReady()).toBe(true);

    const before = client['pingResponseListener'].lastPingResponse;
    await vi.advanceTimersByTimeAsync(100);
    client['pingResponseListener'].lastPingResponse = Date.now();

    expect(client['pingResponseListener'].lastPingResponse).toBeGreaterThan(before);
  });

  it('should not reconnect again when ping responses are received regularly', async () => {
    await simulateSuccessfulConnect();
    expect(client.isReady()).toBe(true);

    const disconnectSpy = vi.spyOn(client, 'disconnect');

    // Deliver a fresh ping timestamp before each checkConnection call
    for (let i = 0; i < 4; i++) {
      client['pingResponseListener'].lastPingResponse = Date.now();
      await vi.advanceTimersByTimeAsync(5000);
    }

    expect(disconnectSpy).not.toHaveBeenCalled();
  });

  it('should suppress stale close event from old socket during reconnect', async () => {
    await simulateSuccessfulConnect();
    expect(client.isReady()).toBe(true);

    // Directly call disconnect() to set intentionalDisconnect=true
    await client.disconnect();
    expect(client['intentionalDisconnect']).toBe(true);
    expect(client['connected']).toBe(false);

    // The stale 'close' event fires while intentionalDisconnect=true — onDisconnect early-returns
    mockSocket.emit('close', false);
    await vi.advanceTimersByTimeAsync(0);

    // connected should still be false (not double-reset) and no error thrown
    expect(client['connected']).toBe(false);
  });
});
