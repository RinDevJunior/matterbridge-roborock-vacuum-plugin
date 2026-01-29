export enum Protocol {
  hello_request = 0,
  hello_response = 1,
  ping_request = 2,
  ping_response = 3,
  general_request = 4,
  general_response = 5,

  rpc_request = 101,
  rpc_response = 102,
  error = 120,
  status_update = 121,
  battery = 122,
  suction_power = 123,
  water_box_mode = 124,
  main_brush_work_time = 125,
  side_brush_work_time = 126,
  filter_work_time = 127,
  additional_props = 128,
  task_complete = 130,
  task_cancel_low_power = 131,
  task_cancel_in_motion = 132,
  charge_status = 133,
  drying_status = 134,
  back_type = 139, // WTF is this
  map_response = 301,
  some_thing_happened_when_socket_closed = 500,
  offline_status = 135,
  clean_times = 136,
  cleaning_reference = 137,
  clean_task_type = 138,
  dock_task_type = 140,
  cleaning_progress = 141,
  fc_state = 142,
}

export enum RPC_Request_Segments {
  timezone = 79,
  network_info = 81,
}

export interface TimezoneInfo {
  timeZoneCity: string;
  timeZoneSec: number;
}

export interface NetworkInfoDTO {
  ipAddress: string;
  mac: string;
  signal: number;
  wifiName: string;
}
