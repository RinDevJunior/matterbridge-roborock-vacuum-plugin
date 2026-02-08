import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { MESSAGE_TIMEOUT_MS } from '../../../constants/index.js';
import { DpsPayload, Protocol, RequestMessage, ResponseMessage } from '../../models/index.js';

export class PendingResponseTracker {
  private readonly pending = new Map<
    number,
    {
      handler: (response: ResponseMessage) => void;
      timer: NodeJS.Timeout;
    }
  >();

  constructor(private readonly logger: AnsiLogger) {}

  public waitFor(messageId: number, request: RequestMessage): Promise<ResponseMessage> {
    return new Promise<ResponseMessage>((handler, reject) => {
      this.logger.debug(`Waiting for response to messageId: ${messageId}, method: ${request.method}`);

      const timer = setTimeout(() => {
        this.pending.delete(messageId);
        reject(new Error(`Message timeout for messageId: ${messageId}, request: ${debugStringify(request)}`));
      }, MESSAGE_TIMEOUT_MS);

      this.pending.set(messageId, { handler, timer });
    });
  }

  public tryResolve(response: ResponseMessage): void {
    // example data1: response.body = { data: { 102: { id: 18755, result: [ 110 ] } } }
    // example data2: response.body = { data: { 102: { id: 13874, result: [ 'ok' ] } } }
    // example data3: response.body = { data: { 123: 101, 124: 202 } }
    // example data4: response.body = { data: { 102: { id: 18728, result: [ { msg_ver: 2, msg_seq: 1156, state: 8, battery: 100, clean_time: 4149, clean_area: 51387500, error_code: 0, map_present: 1, in_cleaning: 0, in_returning: 0, in_fresh_state: 1, lab_status: 1, water_box_status: 1, fan_power: 110, dnd_enabled: 0, map_status: 3, is_locating: 0, lock_status: 0, water_box_mode: 209, distance_off: 155, water_box_carriage_status: 1, mop_forbidden_enable: 1, camera_status: 1, is_exploring: 0, adbumper_status: [ 0, 0, 0 ], water_shortage_status: 0, dock_type: 14, dust_collection_status: 0, auto_dust_collection: 1, avoid_count: 217, mop_mode: 306, in_warmup: 0, back_type: -1, wash_phase: 0, wash_ready: 1, wash_status: 512, debug_mode: 0, collision_avoid_status: 1, switch_map_mode: 1, dock_error_status: 0, charge_status: 1, unsave_map_reason: 0, unsave_map_flag: 0, dry_status: 0, rdt: 0, clean_percent: 0, extra_time: 1364, rss: 2, dss: 168, common_status: 2, repeat: 1, kct: 0, events: [  ], switch_status: 0, last_clean_t: 1769826720, replenish_mode: 0, subdivision_sets: 0, cleaning_info: { target_segment_id: -1, segment_id: -1, fan_power: 102, water_box_status: 202, mop_mode: 306 }, exit_dock: 0, seq_type: 0 } ] } } }
    // example date5: response.body = { data: { 102: { id: 188009, result: [ { carpet_clean_mode: 3 } ] } } },
    // example data6: response.body = { data: { 102: { id: 188007, result: [ { segment: 1, fan_power: 103, water_box_mode: 203, mop_mode: 300, repeat: 2, seq_type: 0 }, { segment: 2, fan_power: 102, water_box_mode: 202, mop_mode: 300, repeat: 1, seq_type: 0 }, { segment: 3, fan_power: 102, water_box_mode: 202, mop_mode: 300, repeat: 1, seq_type: 0 }, { segment: 4, fan_power: 102, water_box_mode: 201, mop_mode: 300, repeat: 1, seq_type: 0 } ] } } }, header: { version: '1.0', seq: 2764, nonce: 998, timestamp: 1769858969, protocol: 102 } }
    // example data7: response.body = { data: { 102: { id: 12167, result: [ { max_multi_map: 1, max_bak_map: 1, multi_map_count: 1, map_info: [ { mapFlag: 0, add_time: 1769859941, length: 9, name: 'First Map', bak_maps: [ { mapFlag: 4, add_time: 1753578164 } ], rooms: [ { id: 1, tag: 14, iot_name_id: '11100845', iot_name: 'Kitchen' }, { id: 2, tag: 9, iot_name_id: '11100849', iot_name: 'Study' }, { id: 3, tag: 6, iot_name_id: '11100842', iot_name: 'Living room' }, { id: 4, tag: 1, iot_name_id: '11100847', iot_name: 'Bedroom' } ], furnitures: [  ] } ] } ] } } }, header: { version: '1.0', seq: 3597, nonce: 2611702970, timestamp: 1769873004, protocol: 4 } }

    if (!response.body) {
      this.logger.debug(`Response message has no body: ${debugStringify(response)}`);
      return;
    }

    let dps = response.get(Protocol.rpc_response) as DpsPayload;
    if (!dps) {
      dps = response.get(Protocol.general_response) as DpsPayload;
    }
    if (!dps) {
      dps = response.get(Protocol.general_request) as DpsPayload;
    }

    if (!dps || (typeof dps.id !== 'number' && typeof dps.id !== 'string')) {
      this.logger.debug(`No valid DpsPayload with id found in response: ${debugStringify(response)}`);
      return;
    }

    const messageId = dps.id;

    const entry = this.pending.get(messageId);
    if (entry) {
      clearTimeout(entry.timer);
      entry.timer.unref();
      this.pending.delete(messageId);
      this.logger.debug(`Resolved messageId: ${messageId}`);
      entry.handler(dps.result as ResponseMessage);
    }
  }

  public cancelAll(): void {
    for (const [_, entry] of this.pending.entries()) {
      clearTimeout(entry.timer);
      entry.timer.unref();
    }
    this.pending.clear();
  }
}
