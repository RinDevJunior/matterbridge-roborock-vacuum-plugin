## Answers

### Q1: Complete `NewFeatureStrBit` enum entries

All members of `NewFeatureStrBit(IntEnum)` from `/Volumes/ExternalSSD/code/references/python-roborock/roborock/device_features.py:10–88`:

| Name                                 | Value                                            |
| ------------------------------------ | ------------------------------------------------ |
| TWO_KEY_REAL_TIME_VIDEO              | 32                                               |
| TWO_KEY_RTV_IN_CHARGING              | 33                                               |
| DIRTY_REPLENISH_CLEAN                | 34                                               |
| AUTO_DELIVERY_FIELD_IN_GLOBAL_STATUS | 35                                               |
| AVOID_COLLISION_MODE                 | 36                                               |
| VOICE_CONTROL                        | 37                                               |
| NEW_ENDPOINT                         | 38                                               |
| PUMPING_WATER                        | 39                                               |
| CORNER_MOP_STRETCH                   | 40                                               |
| HOT_WASH_TOWEL                       | 41                                               |
| FLOOR_DIR_CLEAN_ANY_TIME             | 42                                               |
| PET_SUPPLIES_DEEP_CLEAN              | 43                                               |
| MOP_SHAKE_WATER_MAX                  | 45                                               |
| EXACT_CUSTOM_MODE                    | 47                                               |
| VIDEO_PATROL                         | 48                                               |
| CARPET_CUSTOM_CLEAN                  | 49                                               |
| PET_SNAPSHOT                         | 50                                               |
| CUSTOM_CLEAN_MODE_COUNT              | 51                                               |
| NEW_AI_RECOGNITION                   | 52                                               |
| AUTO_COLLECTION_2                    | 53                                               |
| RIGHT_BRUSH_STRETCH                  | 54                                               |
| SMART_CLEAN_MODE_SET                 | 55                                               |
| DIRTY_OBJECT_DETECT                  | 56                                               |
| NO_NEED_CARPET_PRESS_SET             | 57                                               |
| VOICE_CONTROL_LED                    | 58                                               |
| WATER_LEAK_CHECK                     | 60                                               |
| MIN_BATTERY_15_TO_CLEAN_TASK         | 62                                               |
| GAP_DEEP_CLEAN                       | 63                                               |
| OBJECT_DETECT_CHECK                  | 64                                               |
| IDENTIFY_ROOM                        | 66                                               |
| MATTER                               | 67                                               |
| WORKDAY_HOLIDAY                      | 69                                               |
| CLEAN_DIRECT_STATUS                  | 70                                               |
| MAP_ERASER                           | 71                                               |
| OPTIMIZE_BATTERY                     | 72                                               |
| ACTIVATE_VIDEO_CHARGING_AND_STANDBY  | 73                                               |
| CARPET_LONG_HAIRED                   | 75                                               |
| CLEAN_HISTORY_TIME_LINE              | 76                                               |
| MAX_ZONE_OPENED                      | 77                                               |
| EXHIBITION_FUNCTION                  | 78                                               |
| LDS_LIFTING                          | 79                                               |
| AUTO_TEAR_DOWN_MOP                   | 80                                               |
| SMALL_SIDE_MOP                       | 81                                               |
| SUPPORT_SIDE_BRUSH_UP_DOWN           | 82                                               |
| DRY_INTERVAL_TIMER                   | 83                                               |
| UVC_STERILIZE                        | 84                                               |
| MIDWAY_BACK_TO_DOCK                  | 85                                               |
| SUPPORT_MAIN_BRUSH_UP_DOWN           | 86                                               |
| EGG_DANCE_MODE                       | 87                                               |
| MECHANICAL_ARM_MODE                  | 89                                               |
| TIDYUP_ZONES                         | 89 (alias: `TIDYUP_ZONES = MECHANICAL_ARM_MODE`) |
| CLEAN_TIME_LINE                      | 91                                               |
| CLEAN_THEN_MOP_MODE                  | 93                                               |
| TYPE_IDENTIFY                        | 94                                               |
| SUPPORT_GET_PARTICULAR_STATUS        | 96                                               |
| THREE_D_MAPPING_INNER_TEST           | 97                                               |
| SYNC_SERVER_NAME                     | 98                                               |
| SHOULD_SHOW_ARM_OVER_LOAD            | 99                                               |
| COLLECT_DUST_COUNT_SHOW              | 100                                              |
| SUPPORT_API_APP_STOP_GRASP           | 101                                              |
| CTM_WITH_REPEAT                      | 102                                              |
| SIDE_BRUSH_LIFT_CARPET               | 104                                              |
| DETECT_WIRE_CARPET                   | 105                                              |
| WATER_SLIDE_MODE                     | 106                                              |
| SOAK_AND_WASH                        | 107                                              |
| CLEAN_EFFICIENCY                     | 108                                              |
| BACK_WASH_NEW_SMART                  | 109                                              |
| DUAL_BAND_WI_FI                      | 110                                              |
| PROGRAM_MODE                         | 111                                              |
| CLEAN_FLUID_DELIVERY                 | 112                                              |
| CARPET_LONG_HAIRED_EX                | 113                                              |
| OVER_SEA_CTM                         | 114                                              |
| FULL_DUPLES_SWITCH                   | 115                                              |
| LOW_AREA_ACCESS                      | 116                                              |
| FOLLOW_LOW_OBS                       | 117                                              |
| TWO_GEARS_NO_COLLISION               | 118                                              |
| CARPET_SHAPE_TYPE                    | 119                                              |
| SR_MAP                               | 120                                              |

Notes:

- Integer values 44, 46, 59, 61, 65, 68, 74, 88, 90, 92, 95, 103 have no enum member assigned (gaps in the sequence).
- `TIDYUP_ZONES` is declared as `TIDYUP_ZONES = MECHANICAL_ARM_MODE` — both resolve to 89 at runtime.

---

### Q2: Complete mapping from each `NewFeatureStrBit` member to its `DeviceFeatures` field name

Every field declared with `metadata={"new_feature_str_bit": NewFeatureStrBit.XXX}`, in declaration order. File: `device_features.py:328–475`.

| `NewFeatureStrBit` member            | `DeviceFeatures` field name                         |
| ------------------------------------ | --------------------------------------------------- |
| TWO_KEY_REAL_TIME_VIDEO              | `is_two_key_real_time_video_supported`              |
| TWO_KEY_RTV_IN_CHARGING              | `is_two_key_rtv_in_charging_supported`              |
| DIRTY_REPLENISH_CLEAN                | `is_dirty_replenish_clean_supported`                |
| AUTO_DELIVERY_FIELD_IN_GLOBAL_STATUS | `is_auto_delivery_field_in_global_status_supported` |
| AVOID_COLLISION_MODE                 | `is_avoid_collision_mode_supported`                 |
| VOICE_CONTROL                        | `is_voice_control_supported`                        |
| NEW_ENDPOINT                         | `is_new_endpoint_supported`                         |
| PUMPING_WATER                        | `is_pumping_water_supported`                        |
| CORNER_MOP_STRETCH                   | `is_corner_mop_stretch_supported`                   |
| HOT_WASH_TOWEL                       | `is_hot_wash_towel_supported`                       |
| FLOOR_DIR_CLEAN_ANY_TIME             | `is_floor_dir_clean_any_time_supported`             |
| PET_SUPPLIES_DEEP_CLEAN              | `is_pet_supplies_deep_clean_supported`              |
| MOP_SHAKE_WATER_MAX                  | `is_mop_shake_water_max_supported`                  |
| EXACT_CUSTOM_MODE                    | `is_exact_custom_mode_supported`                    |
| VIDEO_PATROL                         | `is_video_patrol_supported`                         |
| CARPET_CUSTOM_CLEAN                  | `is_carpet_custom_clean_supported`                  |
| PET_SNAPSHOT                         | `is_pet_snapshot_supported`                         |
| CUSTOM_CLEAN_MODE_COUNT              | `is_custom_clean_mode_count_supported`              |
| NEW_AI_RECOGNITION                   | `is_new_ai_recognition_supported`                   |
| AUTO_COLLECTION_2                    | `is_auto_collection_2_supported`                    |
| RIGHT_BRUSH_STRETCH                  | `is_right_brush_stretch_supported`                  |
| SMART_CLEAN_MODE_SET                 | `is_smart_clean_mode_set_supported`                 |
| DIRTY_OBJECT_DETECT                  | `is_dirty_object_detect_supported`                  |
| NO_NEED_CARPET_PRESS_SET             | `is_no_need_carpet_press_set_supported`             |
| VOICE_CONTROL_LED                    | `is_voice_control_led_supported`                    |
| WATER_LEAK_CHECK                     | `is_water_leak_check_supported`                     |
| MIN_BATTERY_15_TO_CLEAN_TASK         | `is_min_battery_15_to_clean_task_supported`         |
| GAP_DEEP_CLEAN                       | `is_gap_deep_clean_supported`                       |
| OBJECT_DETECT_CHECK                  | `is_object_detect_check_supported`                  |
| IDENTIFY_ROOM                        | `is_identify_room_supported`                        |
| MATTER                               | `is_matter_supported`                               |
| WORKDAY_HOLIDAY                      | `is_workday_holiday_supported`                      |
| CLEAN_DIRECT_STATUS                  | `is_clean_direct_status_supported`                  |
| MAP_ERASER                           | `is_map_eraser_supported`                           |
| OPTIMIZE_BATTERY                     | `is_optimize_battery_supported`                     |
| ACTIVATE_VIDEO_CHARGING_AND_STANDBY  | `is_activate_video_charging_and_standby_supported`  |
| CARPET_LONG_HAIRED                   | `is_carpet_long_haired_supported`                   |
| CLEAN_HISTORY_TIME_LINE              | `is_clean_history_time_line_supported`              |
| MAX_ZONE_OPENED                      | `is_max_zone_opened_supported`                      |
| EXHIBITION_FUNCTION                  | `is_exhibition_function_supported`                  |
| LDS_LIFTING                          | `is_lds_lifting_supported`                          |
| AUTO_TEAR_DOWN_MOP                   | `is_auto_tear_down_mop_supported`                   |
| SMALL_SIDE_MOP                       | `is_small_side_mop_supported`                       |
| SUPPORT_SIDE_BRUSH_UP_DOWN           | `is_support_side_brush_up_down_supported`           |
| DRY_INTERVAL_TIMER                   | `is_dry_interval_timer_supported`                   |
| UVC_STERILIZE                        | `is_uvc_sterilize_supported`                        |
| MIDWAY_BACK_TO_DOCK                  | `is_midway_back_to_dock_supported`                  |
| SUPPORT_MAIN_BRUSH_UP_DOWN           | `is_support_main_brush_up_down_supported`           |
| EGG_DANCE_MODE                       | `is_egg_dance_mode_supported`                       |
| MECHANICAL_ARM_MODE                  | `is_mechanical_arm_mode_supported`                  |
| TIDYUP_ZONES                         | `is_tidyup_zones_supported`                         |
| CLEAN_TIME_LINE                      | `is_clean_time_line_supported`                      |
| CLEAN_THEN_MOP_MODE                  | `is_clean_then_mop_mode_supported`                  |
| TYPE_IDENTIFY                        | `is_type_identify_supported`                        |
| SUPPORT_GET_PARTICULAR_STATUS        | `is_support_get_particular_status_supported`        |
| THREE_D_MAPPING_INNER_TEST           | `is_three_d_mapping_inner_test_supported`           |
| SYNC_SERVER_NAME                     | `is_sync_server_name_supported`                     |
| SHOULD_SHOW_ARM_OVER_LOAD            | `is_should_show_arm_over_load_supported`            |
| COLLECT_DUST_COUNT_SHOW              | `is_collect_dust_count_show_supported`              |
| SUPPORT_API_APP_STOP_GRASP           | `is_support_api_app_stop_grasp_supported`           |
| CTM_WITH_REPEAT                      | `is_ctm_with_repeat_supported`                      |
| SIDE_BRUSH_LIFT_CARPET               | `is_side_brush_lift_carpet_supported`               |
| DETECT_WIRE_CARPET                   | `is_detect_wire_carpet_supported`                   |
| WATER_SLIDE_MODE                     | `is_water_slide_mode_supported`                     |
| SOAK_AND_WASH                        | `is_soak_and_wash_supported`                        |
| CLEAN_EFFICIENCY                     | `is_clean_efficiency_supported`                     |
| BACK_WASH_NEW_SMART                  | `is_back_wash_new_smart_supported`                  |
| DUAL_BAND_WI_FI                      | `is_dual_band_wi_fi_supported`                      |
| PROGRAM_MODE                         | `is_program_mode_supported`                         |
| CLEAN_FLUID_DELIVERY                 | `is_clean_fluid_delivery_supported`                 |
| CARPET_LONG_HAIRED_EX                | `is_carpet_long_haired_ex_supported`                |
| OVER_SEA_CTM                         | `is_over_sea_ctm_supported`                         |
| FULL_DUPLES_SWITCH                   | `is_full_duples_switch_supported`                   |
| LOW_AREA_ACCESS                      | `is_low_area_access_supported`                      |
| FOLLOW_LOW_OBS                       | `is_follow_low_obs_supported`                       |
| TWO_GEARS_NO_COLLISION               | `is_two_gears_no_collision_supported`               |
| CARPET_SHAPE_TYPE                    | `is_carpet_shape_type_supported`                    |
| SR_MAP                               | `is_sr_map_supported`                               |

Total: 79 field declarations (MECHANICAL_ARM_MODE and TIDYUP_ZONES are separate field entries despite sharing integer value 89 — they will always decode to the same bit).

---

### Q3: Complete `DeviceFeatures` dataclass field list with Python type annotations

File: `/Volumes/ExternalSSD/code/references/python-roborock/roborock/device_features.py:248–558`

#### Group A — `robot_new_features` (bitmask against lower 32 bits of `new_feature_info`)

| Field name                                 | Type   | Mask       |
| ------------------------------------------ | ------ | ---------- |
| `is_show_clean_finish_reason_supported`    | `bool` | 1          |
| `is_re_segment_supported`                  | `bool` | 4          |
| `is_video_monitor_supported`               | `bool` | 8          |
| `is_any_state_transit_goto_supported`      | `bool` | 16         |
| `is_fw_filter_obstacle_supported`          | `bool` | 32         |
| `is_video_setting_supported`               | `bool` | 64         |
| `is_ignore_unknown_map_object_supported`   | `bool` | 128        |
| `is_set_child_supported`                   | `bool` | 256        |
| `is_carpet_supported`                      | `bool` | 512        |
| `is_record_allowed`                        | `bool` | 1024       |
| `is_mop_path_supported`                    | `bool` | 2048       |
| `is_multi_map_segment_timer_supported`     | `bool` | 4096       |
| `is_current_map_restore_enabled`           | `bool` | 8192       |
| `is_room_name_supported`                   | `bool` | 16384      |
| `is_shake_mop_set_supported`               | `bool` | 262144     |
| `is_map_beautify_internal_debug_supported` | `bool` | 2097152    |
| `is_new_data_for_clean_history`            | `bool` | 4194304    |
| `is_new_data_for_clean_history_detail`     | `bool` | 8388608    |
| `is_flow_led_setting_supported`            | `bool` | 16777216   |
| `is_dust_collection_setting_supported`     | `bool` | 33554432   |
| `is_rpc_retry_supported`                   | `bool` | 67108864   |
| `is_avoid_collision_supported`             | `bool` | 134217728  |
| `is_support_set_switch_map_mode`           | `bool` | 268435456  |
| `is_map_carpet_add_support`                | `bool` | 1073741824 |
| `is_custom_water_box_distance_supported`   | `bool` | 2147483648 |

#### Group B — `upper_32_bits` (bit index applied to upper 32 bits of `new_feature_info` after `>> 32`)

| Field name                                       | Type   | Bit index |
| ------------------------------------------------ | ------ | --------- |
| `is_support_smart_scene`                         | `bool` | 1         |
| `is_support_floor_edit`                          | `bool` | 3         |
| `is_support_furniture`                           | `bool` | 4         |
| `is_wash_then_charge_cmd_supported`              | `bool` | 5         |
| `is_support_room_tag`                            | `bool` | 6         |
| `is_support_quick_map_builder`                   | `bool` | 7         |
| `is_support_smart_global_clean_with_custom_mode` | `bool` | 8         |
| `is_careful_slow_mop_supported`                  | `bool` | 9         |
| `is_egg_mode_supported_from_new_features`        | `bool` | 10        |
| `is_carpet_show_on_map`                          | `bool` | 12        |
| `is_supported_valley_electricity`                | `bool` | 13        |
| `is_unsave_map_reason_supported`                 | `bool` | 14        |
| `is_supported_drying`                            | `bool` | 15        |
| `is_supported_download_test_voice`               | `bool` | 16        |
| `is_support_backup_map`                          | `bool` | 17        |
| `is_support_custom_mode_in_cleaning`             | `bool` | 18        |
| `is_support_remote_control_in_call`              | `bool` | 19        |

#### Group C — `new_feature_str_mask` (bitmask against last 8 hex chars of `new_feature_info_str`)

Tuple is `(mask, slice_count)` — always `slice_count=8` for all entries below.

| Field name                                 | Type   | Mask       |
| ------------------------------------------ | ------ | ---------- |
| `is_support_set_volume_in_call`            | `bool` | 1          |
| `is_support_clean_estimate`                | `bool` | 2          |
| `is_support_custom_dnd`                    | `bool` | 4          |
| `is_carpet_deep_clean_supported`           | `bool` | 8          |
| `is_support_stuck_zone`                    | `bool` | 16         |
| `is_support_custom_door_sill`              | `bool` | 32         |
| `is_wifi_manage_supported`                 | `bool` | 128        |
| `is_clean_route_fast_mode_supported`       | `bool` | 256        |
| `is_support_cliff_zone`                    | `bool` | 512        |
| `is_support_smart_door_sill`               | `bool` | 1024       |
| `is_support_floor_direction`               | `bool` | 2048       |
| `is_back_charge_auto_wash_supported`       | `bool` | 4096       |
| `is_support_incremental_map`               | `bool` | 4194304    |
| `is_offline_map_supported`                 | `bool` | 16384      |
| `is_super_deep_wash_supported`             | `bool` | 32768      |
| `is_ces_2022_supported`                    | `bool` | 65536      |
| `is_dss_believable`                        | `bool` | 131072     |
| `is_main_brush_up_down_supported_from_str` | `bool` | 262144     |
| `is_goto_pure_clean_path_supported`        | `bool` | 524288     |
| `is_water_up_down_drain_supported`         | `bool` | 1048576    |
| `is_setting_carpet_first_supported`        | `bool` | 8388608    |
| `is_clean_route_deep_slow_plus_supported`  | `bool` | 16777216   |
| `is_dynamically_skip_clean_zone_supported` | `bool` | 33554432   |
| `is_dynamically_add_clean_zones_supported` | `bool` | 67108864   |
| `is_left_water_drain_supported`            | `bool` | 134217728  |
| `is_clean_count_setting_supported`         | `bool` | 1073741824 |
| `is_corner_clean_mode_supported`           | `bool` | 2147483648 |

#### Group D — `new_feature_str_bit` (nibble-index into `new_feature_info_str`)

See Q2 answer above — 79 `bool` fields, one per `NewFeatureStrBit` member.

#### Group E — `robot_features` (integer ID present in `feature_info` list from `APP_GET_INIT_STATUS`)

| Field name                       | Type   | Feature ID |
| -------------------------------- | ------ | ---------- |
| `is_led_status_switch_supported` | `bool` | 119        |
| `is_multi_floor_supported`       | `bool` | 120        |
| `is_support_fetch_timer_summary` | `bool` | 122        |
| `is_order_clean_supported`       | `bool` | 123        |
| `is_analysis_supported`          | `bool` | 124        |
| `is_remote_supported`            | `bool` | 125        |
| `is_support_voice_control_debug` | `bool` | 130        |

#### Group F — `model_whitelist` / `model_blacklist`

| Field name                                      | Type   | Source            |
| ----------------------------------------------- | ------ | ----------------- |
| `is_mop_forbidden_supported`                    | `bool` | `model_whitelist` |
| `is_soft_clean_mode_supported`                  | `bool` | `model_whitelist` |
| `is_custom_mode_supported`                      | `bool` | `model_blacklist` |
| `is_support_custom_carpet`                      | `bool` | `model_whitelist` |
| `is_show_general_obstacle_supported`            | `bool` | `model_whitelist` |
| `is_show_obstacle_photo_supported`              | `bool` | `model_whitelist` |
| `is_rubber_brush_carpet_supported`              | `bool` | `model_whitelist` |
| `is_carpet_pressure_use_origin_paras_supported` | `bool` | `model_whitelist` |
| `is_support_mop_back_pwm_set`                   | `bool` | `model_whitelist` |
| `is_collect_dust_mode_supported`                | `bool` | `model_blacklist` |

#### Group G — `product_features` (lookup in per-product feature list)

| Field name                             | Type   |
| -------------------------------------- | ------ |
| `is_support_water_mode`                | `bool` |
| `is_pure_clean_mop_supported`          | `bool` |
| `is_new_remote_view_supported`         | `bool` |
| `is_max_plus_mode_supported`           | `bool` |
| `is_none_pure_clean_mop_with_max_plus` | `bool` |
| `is_clean_route_setting_supported`     | `bool` |
| `is_mop_shake_module_supported`        | `bool` |
| `is_customized_clean_supported`        | `bool` |

#### Raw diagnostic fields (with defaults — not bool)

| Field name             | Type        | Default                                  |
| ---------------------- | ----------- | ---------------------------------------- |
| `new_feature_info`     | `int`       | `0`                                      |
| `new_feature_info_str` | `str`       | `""`                                     |
| `feature_info`         | `list[int]` | `[]` (via `field(default_factory=list)`) |

---

### Q4: `src/` folder structure and recommended location for `featureSetDecoder.ts`

Top-level directories under `src/` and documented purposes (from `docs/CODE_STRUCTURE.md`):

| Directory                | Purpose                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `platform/`              | Platform layer: config validation, device registry, startup state, discovery, configurator                                      |
| `core/`                  | Core domain layer: domain entities, value objects, port interfaces, application models                                          |
| `services/`              | Service layer: DI container, authentication, device management, message routing, polling, connection                            |
| `behaviors/`             | Device behavior implementations (clean mode handlers, enums, protocol-specific logic)                                           |
| `roborockCommunication/` | Communication layer: MQTT, local network, protocol builders/serializers/dispatchers, REST API, routing, DTOs, enums, helpers    |
| `runtimes/`              | Message runtime handlers (cloud, local, home data, extracted pure handler functions)                                            |
| `initialData/`           | Initial data fetchers (battery, operational state, rooms, clean modes, routines, run modes)                                     |
| `constants/`             | Constant definitions (battery, device, distance, ids, timeouts, sensitive data regex)                                           |
| `errors/`                | Custom typed error class hierarchy (BaseError and subtypes)                                                                     |
| `model/`                 | Plugin data/config models (AuthenticationResponse, CleanCommand, DockStationStatus, VacuumStatus, RoborockPluginPlatformConfig) |
| `types/`                 | TypeScript type definitions                                                                                                     |
| `share/`                 | Shared utilities: behaviorFactory, filterLogger, helper, function, runtimeHelper, stateResolver, matterStateNames               |
| `cli/`                   | CLI tool entry point and command implementations                                                                                |
| `tests/`                 | Unit tests (177+ files)                                                                                                         |

**Recommended location: `src/share/featureSetDecoder.ts`**

Rationale:

- `src/share/` is the established home for pure utility functions used across multiple layers.
- All existing `share/` files are pure, stateless, no-side-effect modules: `helper.ts`, `function.ts`, `runtimeHelper.ts`, `stateResolver.ts`, `matterStateNames.ts`.
- `featureSetDecoder.ts` has no DI dependencies, no side effects, operates only on raw string/number inputs, and returns a plain boolean-flag object — this exactly matches the character of every current `share/` file.
- `src/roborockCommunication/helper/` is a plausible alternative but is scoped to communication-layer internals (crypto, chunk buffer, sequence number, name decoding). Feature-flag decoding is domain-level data transformation that will be consumed by layers above the communication layer, so `share/` is the better fit.

---

### Q5: Files using `BigInt(...)` or `parseInt(..., 16)` in `src/`

Search result: **no matches** anywhere in `src/`.

Neither `BigInt(...)` nor `parseInt(..., 16)` appear in any TypeScript file under `src/`. The feature decoder will introduce the first hex-parsing usage in the codebase.

---

## Confidence

- Q1: High. Read the Python source directly; all values are literals.
- Q2: High. Every `new_feature_str_bit` field declaration was read in full from `device_features.py:328–475`.
- Q3: High. Read the entire `DeviceFeatures` dataclass body. All 7 groups and 3 raw fields are accounted for.
- Q4: High. Directory structure confirmed from `docs/CODE_STRUCTURE.md` and existing `share/` file inventory.
- Q5: High. Grep returned no matches with both `BigInt\(` and `parseInt\([^,]+,\s*16\)` patterns over the full `src/` tree.

One nuance: `TIDYUP_ZONES` and `MECHANICAL_ARM_MODE` share integer value 89. The dataclass has two separate field declarations (`is_mechanical_arm_mode_supported` and `is_tidyup_zones_supported`) both pointing to enum members with value 89. Both fields will always decode to the same bit in the hex string.

## Status

answered
