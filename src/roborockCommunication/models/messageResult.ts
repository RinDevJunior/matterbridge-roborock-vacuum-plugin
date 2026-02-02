export interface CloudMessageResult {
  msg_ver: number;
  msg_seq: number;
  state: number;
  battery: number;
  clean_time: number;
  clean_area: number;
  error_code: number;
  map_present: number;
  in_cleaning: number;
  in_returning: number;
  in_fresh_state: number;
  lab_status: number;
  water_box_status: number;
  back_type?: number;
  wash_phase?: number;
  wash_ready?: number;
  wash_status?: number;
  fan_power: number;
  dnd_enabled: number;
  map_status: number;
  is_locating: number;
  lock_status: number;
  water_box_mode: number;
  distance_off: number;
  water_box_carriage_status: number;
  mop_forbidden_enable: number;
  camera_status?: number;
  is_exploring?: number;
  adbumper_status: number[];
  water_shortage_status?: number;
  dock_type: number;
  dust_collection_status: number;
  auto_dust_collection: number;
  avoid_count?: number;
  mop_mode?: number;
  debug_mode: number;
  in_warmup?: number;
  collision_avoid_status?: number;
  switch_map_mode: number;
  dock_error_status: number;
  charge_status: number;
  unsave_map_reason?: number;
  unsave_map_flag?: number;
  dry_status?: number;
  rdt?: number;
  clean_percent?: number;
  extra_time?: number;
  rss?: number;
  dss?: number;
  common_status?: number;
  last_clean_t?: number;
  replenish_mode?: number;
  repeat?: number;
  kct?: number;
  subdivision_sets?: number;
  cleaning_info?: CleanInformation;
  exit_dock?: number;
  seq_type?: number;
}

export interface CleanInformation {
  target_segment_id: number;
  segment_id: number;
  fan_power: number;
  water_box_status: number;
  mop_mode: number;
}

export enum CarpetCleanMode {
  Avoid = 0,
  Ignore = 2,
  Cross = 3,
  DynamicLift = 200, // TODO
}
