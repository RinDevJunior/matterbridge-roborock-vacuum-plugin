import { EventEmitter } from 'node:events';

declare global {
  var mockSocketQueue: ReturnType<typeof makeMockSocket>[];
}

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { asPartial, createMockLogger, mkUser } from '../../helpers/testUtils.js';
import { LocalNetworkClient } from '../../../roborockCommunication/local/localClient.js';
import { MessageContext } from '../../../roborockCommunication/models/messageContext.js';
import { V1PendingResponseTracker } from '../../../roborockCommunication/routing/services/v1PendingResponseTracker.js';
import { V1ResponseBroadcaster } from '../../../roborockCommunication/routing/listeners/v1ResponseBroadcaster.js';

vi.mock('node:net', () => {
  function Socket(this: any): any {
    return globalThis.mockSocketQueue?.shift();
  }
  return { Socket };
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

function createClient(): LocalNetworkClient {
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

  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.mockSocketQueue = [];
    client = createClient();
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

  async function simulateSuccessfulConnect(socket: ReturnType<typeof makeMockSocket>): Promise<void> {
    client['helloResponseListener'].waitFor = vi.fn().mockResolvedValue({
      header: { nonce: 9999, version: 'L01' },
    });
    client.connect();
    socket.emit('connect');
    await vi.advanceTimersByTimeAsync(0);
  }

  it('should trigger reconnect when no ping response received for 15s', async () => {
    const socket = makeMockSocket();
    globalThis.mockSocketQueue = [socket];
    await simulateSuccessfulConnect(socket);
    expect(client.isReady()).toBe(true);

    const disconnectSpy = vi.spyOn(client, 'disconnect');
    const connectSpy = vi.spyOn(client, 'connect');

    // Pre-populate queue for the reconnect's connect() call
    globalThis.mockSocketQueue = [makeMockSocket()];

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
    const socket = makeMockSocket();
    globalThis.mockSocketQueue = [socket];
    await simulateSuccessfulConnect(socket);
    expect(client.isReady()).toBe(true);

    // Pre-populate queue for the reconnect's connect() call
    globalThis.mockSocketQueue = [makeMockSocket()];
    await vi.advanceTimersByTimeAsync(20000);

    // Reconnect with fresh client and socket
    client = createClient();
    const socket2 = makeMockSocket();
    globalThis.mockSocketQueue = [socket2];
    await simulateSuccessfulConnect(socket2);
    expect(client.isReady()).toBe(true);

    const before = client['pingResponseListener'].lastPingResponse;
    await vi.advanceTimersByTimeAsync(100);
    client['pingResponseListener'].lastPingResponse = Date.now();

    expect(client['pingResponseListener'].lastPingResponse).toBeGreaterThan(before);
  });

  it('should not reconnect again when ping responses are received regularly', async () => {
    const socket = makeMockSocket();
    globalThis.mockSocketQueue = [socket];
    await simulateSuccessfulConnect(socket);
    expect(client.isReady()).toBe(true);

    const disconnectSpy = vi.spyOn(client, 'disconnect');

    // Deliver a fresh ping timestamp before each checkConnection call
    for (let i = 0; i < 4; i++) {
      client['pingResponseListener'].lastPingResponse = Date.now();
      await vi.advanceTimersByTimeAsync(5000);
    }

    expect(disconnectSpy).not.toHaveBeenCalled();
  });

  it('should suppress stale close event from old socket when no new socket exists', async () => {
    const socket = makeMockSocket();
    globalThis.mockSocketQueue = [socket];
    await simulateSuccessfulConnect(socket);
    expect(client['connected']).toBe(true);

    // Disconnect — socket reference captured in closure is no longer this.socket
    await client.disconnect();
    expect(client['connected']).toBe(false);

    // Stale 'close' event: socket !== this.socket (undefined) → handler returns early
    socket.emit('close', false);
    await vi.advanceTimersByTimeAsync(0);

    expect(client['connected']).toBe(false);
  });

  describe('stale socket race condition (closure-based guard)', () => {
    it('should not destroy new socket when old socket fires stale close event after reconnect', async () => {
      const socketA = makeMockSocket();
      const socketB = makeMockSocket();
      globalThis.mockSocketQueue = [socketA, socketB];

      await simulateSuccessfulConnect(socketA);
      expect(client.isReady()).toBe(true);

      // disconnect() destroys socketA, connect() creates socketB
      await client.disconnect();
      client.connect();

      // socketA fires stale 'close' (as happens async in real Node.js after destroy())
      // handler checks: this.socket (socketB) !== socket (socketA) → returns early
      socketA.emit('close', false);
      await vi.advanceTimersByTimeAsync(0);

      expect(socketB.destroy).not.toHaveBeenCalled();
    });

    it('should not destroy new socket when old socket fires stale error event after reconnect', async () => {
      const socketA = makeMockSocket();
      const socketB = makeMockSocket();
      globalThis.mockSocketQueue = [socketA, socketB];

      await simulateSuccessfulConnect(socketA);
      expect(client.isReady()).toBe(true);

      await client.disconnect();
      client.connect();

      // socketA fires stale 'error'
      socketA.emit('error', new Error('stale network error'));
      await vi.advanceTimersByTimeAsync(0);

      expect(socketB.destroy).not.toHaveBeenCalled();
    });

    it('should process close event from the current socket normally', async () => {
      const socket = makeMockSocket();
      globalThis.mockSocketQueue = [socket];

      await simulateSuccessfulConnect(socket);
      expect(client['connected']).toBe(true);

      // 'close' from the current socket → this.socket === socket → processed
      socket.emit('close', false);
      await vi.advanceTimersByTimeAsync(0);

      expect(client['connected']).toBe(false);
    });

    it('should not destroy new socket when ping-timeout reconnect fires old socket close event late', async () => {
      const socketA = makeMockSocket();
      const socketB = makeMockSocket();
      globalThis.mockSocketQueue = [socketA, socketB];

      await simulateSuccessfulConnect(socketA);
      expect(client.isReady()).toBe(true);

      // Pre-populate hello mock for socketB reconnect
      client['helloResponseListener'].waitFor = vi.fn().mockResolvedValue({
        header: { nonce: 9999, version: 'L01' },
      });

      // Advance past 15s ping timeout — checkConnection calls disconnect() + connect()
      for (let tick = 0; tick < 4; tick++) {
        await vi.advanceTimersByTimeAsync(5000);
      }

      // socketA fires its 'close' event late (after connect() has set this.socket = socketB)
      socketA.emit('close', false);
      await vi.advanceTimersByTimeAsync(0);

      expect(socketB.destroy).not.toHaveBeenCalled();
    });
  });
});
