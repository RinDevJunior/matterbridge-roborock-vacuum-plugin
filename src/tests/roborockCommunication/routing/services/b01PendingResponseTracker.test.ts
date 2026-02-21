import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { B01PendingResponseTracker } from '../../../../roborockCommunication/routing/services/b01PendingResponseTracker.js';
import {
  HeaderMessage,
  RequestMessage,
  ResponseBody,
  ResponseMessage,
} from '../../../../roborockCommunication/models/index.js';
import { createMockLogger } from '../../../helpers/testUtils.js';
import { AnsiLogger } from 'matterbridge/logger';

function makeResponse(
  timestamp: number,
  protocol: number,
  data: Record<string, unknown>,
  duid = 'test-duid',
): ResponseMessage {
  const header = new HeaderMessage('B01', 1, 0, timestamp, protocol);
  const body = new ResponseBody(data as ResponseBody['data']);
  return new ResponseMessage(duid, header, body);
}

function makeRequest(timestamp: number, protocol: number): RequestMessage {
  return new RequestMessage({ timestamp, protocol: protocol, messageId: 1234, nonce: 5678 });
}

describe('B01PendingResponseTracker', () => {
  let logger: AnsiLogger;
  let tracker: B01PendingResponseTracker;
  const duid = 'test-duid';

  beforeEach(() => {
    vi.useFakeTimers();
    logger = createMockLogger();
    tracker = new B01PendingResponseTracker(logger, 500, 1);
  });

  afterEach(() => {
    tracker.cancelAll();
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should resolve with a single response after collection window', async () => {
    const request = makeRequest(100, 101);
    const promise = tracker.waitFor(request, duid);

    const response = makeResponse(101, 102, { '101': { '108': 4 } });
    tracker.tryResolve(response);

    vi.advanceTimersByTime(500);

    const result = await promise;
    expect(result.body?.data).toEqual({ rpc_request: { voice_version: 4 } });
  });

  it('should merge multiple responses into one', async () => {
    const request = makeRequest(100, 101);
    const promise = tracker.waitFor(request, duid);

    tracker.tryResolve(makeResponse(101, 102, { '101': { '108': 4 } }));
    tracker.tryResolve(makeResponse(101, 102, { '101': { '36': 105 } }));
    tracker.tryResolve(makeResponse(101, 102, { '121': 10, '122': 100 }));

    vi.advanceTimersByTime(500);

    const result = await promise;
    const rpcRequest = result.body?.data['rpc_request'] as unknown as Record<string, unknown>;
    expect(rpcRequest['voice_version']).toBe(4);
    expect(rpcRequest['voice_language']).toBe(105);
    expect(rpcRequest['state']).toBe(10);
    expect(rpcRequest['battery']).toBe(100);
  });

  it('should reset collection window on each new response', async () => {
    const request = makeRequest(100, 101);
    const promise = tracker.waitFor(request, duid);

    tracker.tryResolve(makeResponse(101, 102, { '101': { '108': 4 } }));
    vi.advanceTimersByTime(300);

    tracker.tryResolve(makeResponse(101, 102, { '101': { '36': 105 } }));
    vi.advanceTimersByTime(300);

    tracker.tryResolve(makeResponse(101, 102, { '121': 10 }));
    vi.advanceTimersByTime(500);

    const result = await promise;
    const rpcRequest = result.body?.data['rpc_request'] as unknown as Record<string, unknown>;
    expect(rpcRequest['voice_version']).toBe(4);
    expect(rpcRequest['voice_language']).toBe(105);
    expect(rpcRequest['state']).toBe(10);
  });

  it('should reject on overall timeout when no responses arrive', async () => {
    const request = makeRequest(100, 101);
    const promise = tracker.waitFor(request, duid);

    vi.advanceTimersByTime(10000);

    await expect(promise).rejects.toThrow('Timeout');
  });

  it('should ignore responses with non-matching timestamp', async () => {
    const request = makeRequest(100, 101);
    const promise = tracker.waitFor(request, duid);

    tracker.tryResolve(makeResponse(200, 102, { '101': { '108': 4 } }));

    vi.advanceTimersByTime(10000);

    await expect(promise).rejects.toThrow('Timeout');
  });

  it('should ignore responses with non-matching protocol', async () => {
    const request = makeRequest(100, 101);
    const promise = tracker.waitFor(request, duid);

    tracker.tryResolve(makeResponse(101, 5, { '101': { '108': 4 } }));

    vi.advanceTimersByTime(10000);

    await expect(promise).rejects.toThrow('Timeout');
  });

  it('should respect configurable timestamp tolerance', async () => {
    const tolerantTracker = new B01PendingResponseTracker(logger, 500, 2);
    const request = makeRequest(100, 101);
    const promise = tolerantTracker.waitFor(request, duid);

    tolerantTracker.tryResolve(makeResponse(102, 102, { '101': { '36': 105 } }));

    vi.advanceTimersByTime(500);

    const result = await promise;
    expect(result.body?.data['rpc_request']).toEqual({ voice_language: 105 });

    tolerantTracker.cancelAll();
  });

  it('should reject timestamp outside tolerance range', async () => {
    const tolerantTracker = new B01PendingResponseTracker(logger, 500, 2);
    const request = makeRequest(100, 101);
    const promise = tolerantTracker.waitFor(request, duid);

    tolerantTracker.tryResolve(makeResponse(103, 102, { '101': { '36': 105 } }));

    vi.advanceTimersByTime(10000);

    await expect(promise).rejects.toThrow('Timeout');

    tolerantTracker.cancelAll();
  });

  it('should cancel all pending entries', async () => {
    const request = makeRequest(100, 101);
    const promise = tracker.waitFor(request, duid);

    tracker.cancelAll();

    vi.advanceTimersByTime(10000);

    await expect(promise).rejects.toThrow();
  });

  it('should merge real B01 multi-response data from tmp.log into final result', async () => {
    const duid = 'device-abc';

    // Request: timestamp=1771309419, protocol=101 (rpc_request)
    const request = makeRequest(1771309419, 101);
    const promise = tracker.waitFor(request, duid);

    // Response 1: { 101: { 108: 4 } }
    tracker.tryResolve(makeResponse(1771309420, 102, { '101': { '108': 4 } }, duid));

    // Response 2: { 101: { 36: 105 } }
    tracker.tryResolve(makeResponse(1771309420, 102, { '101': { '36': 105 } }, duid));

    // Response 3: full state payload
    tracker.tryResolve(
      makeResponse(
        1771309420,
        102,
        {
          '101': {
            '6': 2,
            '7': 0,
            '25': 1,
            '26': 41,
            '29': 3838,
            '30': 176,
            '31': 4057,
            '37': 1,
            '40': 1,
            '45': 1,
            '47': 0,
            '50': 0,
            '51': true,
            '53': false,
            '60': 1,
            '67': 16,
            '76': 0,
            '78': 0,
            '79': { timeZoneCity: 'Europe/Paris', timeZoneSec: 3600 },
            '80': 0,
            '81': { ipAdress: '192.168.1.1', mac: 'AA:BB:CC:DD:EE:FF', signal: -40, wifiName: 'MyWifi' },
            '83': 1,
            '86': 1,
            '87': 0,
            '88': 0,
            '90': 0,
            '92': { disturb_dust_enable: 1, disturb_light: 0, disturb_resume_clean: 1, disturb_voice: 0 },
            '93': 0,
            '96': 0,
            '104': 0,
            '105': false,
            '109': 'de',
            '207': 0,
          },
          '121': 10,
          '122': 100,
          '123': 2,
          '124': 0,
          '125': 69,
          '126': 78,
          '127': 78,
          '136': 1,
          '137': 1,
          '138': 1,
          '139': 5,
        },
        duid,
      ),
    );

    vi.advanceTimersByTime(500);

    const result = await promise;
    const data = result.body?.data;

    // Numeric keys mapped via Q10RequestCode enum; unmapped keys stay as numbers
    expect(result.duid).toBe(duid);
    expect(result.header).toEqual(expect.objectContaining({ version: 'B01', timestamp: 1771309420, protocol: 102 }));
    expect(data).toEqual({
      rpc_request: {
        voice_version: 4,
        voice_language: 105,
        clean_time: 2,
        clean_area: 0,
        not_disturb: 1,
        volume: 41,
        total_clean_area: 3838,
        total_clean_count: 176,
        total_clean_time: 4057,
        dust_switch: 1,
        mop_state: 1,
        auto_boost: 1,
        child_lock: 0,
        dust_setting: 0,
        map_save_switch: true,
        recent_clean_record: false,
        multi_map_switch: 1,
        sensor_life: 16,
        carpet_clean_type: 0,
        clean_line: 0,
        timezone: { timeZoneCity: 'Europe/Paris', timeZoneSec: 3600 },
        area_unit: 0,
        networkinfo: { ipAdress: '192.168.1.1', mac: 'AA:BB:CC:DD:EE:FF', signal: -40, wifiName: 'MyWifi' },
        robot_type: 1,
        line_laser_obstacle_avoidance: 1,
        clean_progress: 0,
        ground_clean: 0,
        fault: 0,
        not_disturb_expand: { disturb_dust_enable: 1, disturb_light: 0, disturb_resume_clean: 1, disturb_voice: 0 },
        timer_type: 0,
        add_clean_state: 0,
        breakpoint_clean: 0,
        valley_point_charging: false,
        robot_country_code: 'de',
        ceip: 0,
        state: 10,
        battery: 100,
        fan_power: 2,
        water_box_mode: 0,
        main_brush_life: 69,
        side_brush_life: 78,
        filter_life: 78,
        clean_times: 1,
        cleaning_reference: 1,
        clean_task_type: 1,
        back_type: 5,
      },
    });
  });

  it('should ignore responses with no body', async () => {
    const request = makeRequest(100, 101);
    const promise = tracker.waitFor(request, duid);

    const header = new HeaderMessage('B01', 1, 0, 101, 102);
    const noBodyResponse = new ResponseMessage(duid, header, undefined);
    tracker.tryResolve(noBodyResponse);

    vi.advanceTimersByTime(10000);

    await expect(promise).rejects.toThrow('Timeout');
  });
});
