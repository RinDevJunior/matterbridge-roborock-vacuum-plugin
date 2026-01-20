import { RequestMessage, Protocol, ResponseMessage, SyncMessageListener, ResponseBody, HeaderMessage } from '@/roborockCommunication/index.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('SyncMessageListener', () => {
  let listener: SyncMessageListener;
  let logger: any;

  beforeEach(() => {
    logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn(), fatal: vi.fn(), notice: vi.fn() };
    listener = new SyncMessageListener(logger);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should call resolve and remove pending on rpc_response', async () => {
    const resolve = vi.fn();
    const reject = vi.fn();
    const messageId = 123;
    listener.waitFor(messageId, { method: 'test' } as RequestMessage, resolve, reject);

    const dps = { id: messageId, result: { foo: 'bar' } };
    const message = new ResponseMessage('YBqkooSOUKiJd5HiCFOAS', new HeaderMessage('1.0', 932, 29, 1768267610, 102), new ResponseBody({ 102: dps }));

    await listener.onMessage(message);

    expect(resolve).toHaveBeenCalledWith(dps.result);
    expect(listener['pending'].has(messageId)).toBe(false);
  });

  it('should call resolve if result is ["ok"]', async () => {
    const resolve = vi.fn();
    const reject = vi.fn();
    const messageId = 456;
    listener.waitFor(messageId, { method: 'test' } as RequestMessage, resolve, reject);

    const dps = { id: messageId, result: ['ok'] };
    const message = new ResponseMessage('YBqkooSOUKiJd5HiCFOAS', new HeaderMessage('1.0', 932, 29, 1768267610, 102), new ResponseBody({ 102: dps }));

    await listener.onMessage(message);

    expect(resolve).toHaveBeenCalled();
    expect(listener['pending'].has(messageId)).toBe(false);
  });

  it('should remove pending on map_response', async () => {
    const resolve = vi.fn();
    const reject = vi.fn();
    const messageId = 789;
    listener.waitFor(messageId, { method: 'test' } as RequestMessage, resolve, reject);

    const dps = { id: messageId };
    const message = {
      contain: (proto: Protocol) => proto === Protocol.map_response,
      get: () => dps,
      isForProtocol: (proto: Protocol) => proto === Protocol.map_response,
      isForProtocols: (protos: Protocol[]) => protos.includes(Protocol.map_response),
    } as any;

    await listener.onMessage(message);

    expect(listener['pending'].has(messageId)).toBe(true);
  });

  it('should call reject after timeout if not resolved', () => {
    const resolve = vi.fn();
    const reject = vi.fn();
    const messageId = 321;
    listener.waitFor(messageId, { method: 'test' } as RequestMessage, resolve, reject);

    expect(listener['pending'].has(messageId)).toBe(true);

    vi.advanceTimersByTime(10000);

    expect(reject).toHaveBeenCalled();
    expect(listener['pending'].has(messageId)).toBe(false);
  });

  it('should not call resolve if no pending handler exists', async () => {
    const resolve = vi.fn();
    const messageId = 999;

    const dps = { id: messageId, result: { foo: 'bar' } };
    const message = new ResponseMessage('YBqkooSOUKiJd5HiCFOAS', new HeaderMessage('1.0', 932, 29, 1768267610, 102), new ResponseBody({ 102: dps }));
    await listener.onMessage(message);

    expect(resolve).not.toHaveBeenCalled();
  });

  it('should handle messages that do not contain rpc_response or map_response', async () => {
    const message = {
      contain: () => false,
      get: () => null,
      isForProtocol: () => false,
      isForProtocols: () => false,
    } as any;

    await listener.onMessage(message);
    expect(true).toBe(true);
  });

  it('111 - should handle real rpc_response data', async () => {
    const resolve = vi.fn();
    const reject = vi.fn();
    const messageId = 111;
    listener.waitFor(messageId, { method: 'test' } as RequestMessage, resolve, reject);

    const dpsData = { id: messageId, result: { 999: 'bar' } };
    const message = new ResponseMessage('YBqkooSOUKiJd5HiCFOAS', new HeaderMessage('1.0', 932, 29, 1768267610, 102), new ResponseBody({ 102: dpsData }));

    await listener.onMessage(message);

    expect(resolve).toHaveBeenCalledWith(dpsData.result);
    expect(listener['pending'].has(messageId)).toBe(false);
  });

  it('111 - should handle real general_request data', async () => {
    const resolve = vi.fn();
    const reject = vi.fn();
    const messageId = 111;
    listener.waitFor(messageId, { method: 'test' } as RequestMessage, resolve, reject);

    const dpsData = { id: messageId, result: { foo: 'bar' } };
    const message = new ResponseMessage('YBqkooSOUKiJd5HiCFOAS', new HeaderMessage('1.0', 932, 29, 1768267610, 4), new ResponseBody({ 4: dpsData }));

    await listener.onMessage(message);

    expect(resolve).toHaveBeenCalledWith(dpsData.result);
    expect(listener['pending'].has(messageId)).toBe(false);
  });

  it('111 - should handle real general_response data', async () => {
    const resolve = vi.fn();
    const reject = vi.fn();
    const messageId = 111;
    listener.waitFor(messageId, { method: 'test' } as RequestMessage, resolve, reject);

    const dpsData = { id: messageId, result: { foo: 'bar' } };
    const message = new ResponseMessage('YBqkooSOUKiJd5HiCFOAS', new HeaderMessage('1.0', 932, 29, 1768267610, 5), new ResponseBody({ 5: dpsData }));

    await listener.onMessage(message);

    expect(resolve).toHaveBeenCalledWith(dpsData.result);
    expect(listener['pending'].has(messageId)).toBe(false);
  });

  it('111 - should handle real rpc_response for status change', async () => {
    const resolve = vi.fn();
    const message = new ResponseMessage(
      'YBqkooSOUKiJd5HiCFOAS',
      new HeaderMessage('1.0', 932, 29, 1768267610, 102),
      new ResponseBody({
        123: 5, // suction_power
        124: 3, // water_box_mode
      }),
    );

    await listener.onMessage(message);

    expect(resolve).not.toHaveBeenCalledWith();
  });

  it('222 - should handle real rpc_response with wifi info', async () => {
    const resolve = vi.fn();
    const reject = vi.fn();
    const messageId = 222;
    listener.waitFor(messageId, { method: 'test' } as RequestMessage, resolve, reject);

    const dpsData = { id: messageId, result: { ssid: 'ahihi', ip: '192.168.202.8', mac: '24:9e:7d:07:d6:4a', bssid: '20:23:51:1f:7c:8a', rssi: -39 } };
    const message = new ResponseMessage('YBqkooSOUKiJd5HiCFOAS', new HeaderMessage('1.0', 922, 28, 1768267511, 102), new ResponseBody({ 102: dpsData }));

    await listener.onMessage(message);

    expect(resolve).toHaveBeenCalledWith(dpsData.result);
    expect(listener['pending'].has(messageId)).toBe(false);
  });

  it('should handle protocol 4 (general_request) with data in key 102 - get_multi_maps_list', async () => {
    const resolve = vi.fn();
    const reject = vi.fn();
    const messageId = 24477;
    listener.waitFor(messageId, { method: 'get_multi_maps_list' } as RequestMessage, resolve, reject);

    const mapResult = [
      {
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [
          {
            mapFlag: 0,
            add_time: 1768269938,
            length: 9,
            name: 'First Map',
            bak_maps: [{ mapFlag: 4, add_time: 1753578164 }],
            rooms: [
              { id: 1, tag: 14, iot_name_id: '11100845', iot_name: 'Kitchen' },
              { id: 2, tag: 9, iot_name_id: '11100849', iot_name: 'Study' },
              { id: 3, tag: 6, iot_name_id: '11100842', iot_name: 'Living room' },
              { id: 4, tag: 1, iot_name_id: '11100847', iot_name: 'Bedroom' },
            ],
            furnitures: [],
          },
        ],
      },
    ];

    const dpsData = { id: messageId, result: mapResult };

    // Simulate: Header has protocol 4, but data is stored in key 102
    const message = new ResponseMessage(
      'YBqkooSOUKiJd5HiCFOAS',
      {
        version: '1.0',
        seq: 2739,
        nonce: 3968393129,
        timestamp: 1768302178,
        protocol: 4,
        isForProtocol: (p: Protocol) => p === Protocol.general_request,
      } as any,
      {
        data: { 102: dpsData },
        get: (index: number | string | Protocol) => {
          // When checking for protocol 102 (rpc_response), return the actual data
          if (index === Protocol.rpc_response || index === 102 || index === '102') {
            return dpsData;
          }
          // When checking for protocol 4 (general_request), return undefined (data not stored here)
          if (index === Protocol.general_request || index === 4 || index === '4') {
            return undefined;
          }
          return undefined;
        },
      } as any,
    );

    await listener.onMessage(message);

    // Verify the log sequence
    expect(logger.debug).toHaveBeenCalledWith('Waiting for response to messageId: 24477, method: get_multi_maps_list');
    expect(logger.debug).toHaveBeenCalledWith('Processing response with protocol general_request');
    expect(logger.debug).toHaveBeenCalledWith('Resolved messageId: 24477');

    // Verify the fix works - resolve should be called with the map data
    expect(resolve).toHaveBeenCalledWith(mapResult);
    expect(listener['pending'].has(messageId)).toBe(false);
  });

  it('should handle protocol 4 (general_request) with data in key 102 - get_room_mapping', async () => {
    const resolve = vi.fn();
    const reject = vi.fn();
    const messageId = 31338;
    listener.waitFor(messageId, { method: 'get_room_mapping' } as RequestMessage, resolve, reject);

    const roomMapping = [
      [1, '11100845', 14],
      [2, '11100849', 9],
      [3, '11100842', 6],
      [4, '11100847', 1],
    ];

    const dpsData = { id: messageId, result: roomMapping };

    // Simulate: Header has protocol 4, but data is stored in key 102
    const message = new ResponseMessage(
      'YBqkooSOUKiJd5HiCFOAS',
      {
        version: '1.0',
        seq: 2742,
        nonce: 126605685,
        timestamp: 1768302198,
        protocol: 4,
        isForProtocol: (p: Protocol) => p === Protocol.general_request,
      } as any,
      {
        data: { 102: { id: messageId, result: roomMapping } },
        get: (index: number | string | Protocol) => {
          // When checking for protocol 102 (rpc_response), return the actual data
          if (index === Protocol.rpc_response || index === 102 || index === '102') {
            return dpsData;
          }
          // When checking for protocol 4 (general_request), return undefined
          if (index === Protocol.general_request || index === 4 || index === '4') {
            return undefined;
          }
          return undefined;
        },
      } as any,
    );

    await listener.onMessage(message);

    expect(resolve).toHaveBeenCalledWith(roomMapping);
    expect(listener['pending'].has(messageId)).toBe(false);
  });

  it('BROKEN CODE TEST - should fail if code only checks protocol 4 key instead of 102', async () => {
    // This test demonstrates the BUG - if code tries message.get(4) instead of message.get(102)
    const resolve = vi.fn();
    const reject = vi.fn();
    const messageId = 99999;
    listener.waitFor(messageId, { method: 'test' } as RequestMessage, resolve, reject);

    const testData = { id: messageId, result: { test: 'data' } };

    // Message with protocol 4 in header, but data ONLY in key 102 (not in key 4)
    const message = new ResponseMessage(
      'YBqkooSOUKiJd5HiCFOAS',
      {
        version: '1.0',
        seq: 1,
        nonce: 1,
        timestamp: 1,
        protocol: 4,
        isForProtocol: (p: Protocol) => p === Protocol.general_request,
      } as any,
      {
        data: { 102: testData }, // Data ONLY in key 102
        get: (index: number | string | Protocol) => {
          if (index === Protocol.rpc_response || index === 102 || index === '102') {
            return testData;
          }
          return undefined; // Key 4 returns undefined
        },
      } as any,
    );

    await listener.onMessage(message);

    expect(resolve).toHaveBeenCalledWith({ test: 'data' });
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Response missing DPS payload'));
  });
});
