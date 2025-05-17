export enum VacuumErrorCode {
  none = 0,
  lidar_blocked = 1,
  bumper_stuck = 2,
  wheels_suspended = 3,
  cliff_sensor_error = 4,
  main_brush_jammed = 5,
  side_brush_jammed = 6,
  wheels_jammed = 7,
  robot_trapped = 8,
  no_dustbin = 9,
  strainer_error = 10, // Filter is wet or blocked
  compass_error = 11, // Strong magnetic field detected
  low_battery = 12,
  charging_error = 13,
  battery_error = 14,
  wall_sensor_dirty = 15,
  robot_tilted = 16,
  side_brush_error = 17,
  fan_error = 18,
  dock = 19, // Dock not connected to power
  optical_flow_sensor_dirt = 20,
  vertical_bumper_pressed = 21,
  dock_locator_error = 22,
  return_to_dock_fail = 23,
  nogo_zone_detected = 24,
  visual_sensor = 25, // Camera error
  light_touch = 26, // Wall sensor error
  vibrarise_jammed = 27,
  robot_on_carpet = 28,
  filter_blocked = 29,
  invisible_wall_detected = 30,
  cannot_cross_carpet = 31,
  internal_error = 32,
  clean_auto_empty_dock = 34, // Clean auto-empty dock
  auto_empty_dock_voltage = 35, // Auto empty dock voltage error
  mopping_roller_jammed = 36, // Wash roller may be jammed
  mopping_roller_not_lowered = 37, // wash roller not lowered properly
  clear_water_box_hoare = 38, // Check the clean water tank
  dirty_water_box_hoare = 39, // Check the dirty water tank
  sink_strainer_hoare = 40, // Reinstall the water filter
  clear_water_box_exception = 41, // Clean water tank empty
  clear_brush_installed_properly = 42, // Check that the water filter has been correctly installed
  clear_brush_positioning_error = 43, // Positioning button error
  filter_screen_exception = 44, // Clean the dock water filter
  mopping_roller_jammed2 = 45, // Wash roller may be jammed
  up_water_exception = 48,
  drain_water_exception = 49,
  temperature_protection = 51, // Unit temperature protection
  clean_carousel_exception = 52,
  clean_carousel_water_full = 53,
  water_carriage_drop = 54,
  check_clean_carouse = 55,
  audio_error = 56,
}

export enum DockErrorCode {
  ok = 0,
  duct_blockage = 34,
  water_empty = 38,
  waste_water_tank_full = 39,
  maintenance_brush_jammed = 42,
  dirty_tank_latch_open = 44,
  no_dustbin = 46,
  cleaning_tank_full_or_blocked = 53,
}

//TODO: correct this
export enum FAN_SPEEDS {
  LOW = 101,
  MEDIUM = 102,
  HIGH = 103,
  MAX = 104,
  OFF = 105, // also known as mop mode
}

export enum WATER_GRADES {
  OFF = 200,
  LOW = 201,
  MEDIUM = 202,
  HIGH = 203,
}

export const SUPPORTED_ATTACHMENTS = ['WATERTANK', 'MOP'];
