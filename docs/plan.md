## Task

Implement `src/share/featureSetDecoder.ts` — a pure TypeScript function that decodes `featureSet` (64-bit integer string) and `newFeatureSet` (hex string) into a `DeviceFeatures` interface with ~173 boolean capability flags and 3 raw diagnostic fields.

No wiring into the capability registry — decoder only.

---

## Approach

Single new file. No imports from any project module — only native TypeScript / ESNext. Use `BigInt` to safely parse the 64-bit `featureSet` string.

Four decoding groups:

- **Group A**: lower 32 bits of `featureSet` — bitwise AND with fixed masks
- **Group B**: upper 32 bits of `featureSet` — bit-index test (`(upper32 >> bitIdx) & 1`)
- **Group C**: last 8 hex chars of `newFeatureSet` parsed as 32-bit integer — bitwise AND with fixed masks
- **Group D**: nibble-index extraction from `newFeatureSet` — for each `NewFeatureStrBit` value `n`, extract bit `n` from the hex string treated as an LSB-first bit array: nibble at `hexStr[length - 1 - Math.floor(n/4)]`, bit `n % 4` within that nibble
- **Groups E, F, G** (robot_features, model_whitelist, product_features) are included in the interface but always default to `false` — they require inputs unavailable to this decoder

---

## Files to Create

- `src/share/featureSetDecoder.ts` — interface definition + pure decoder function

---

## Files to Modify

None.

---

## Implementation Steps

### Step 1 — Export `DeviceFeatures` interface

Declare `export interface DeviceFeatures` with every field below. All boolean fields default to `false` when not set. Raw fields have their own types.

#### Group A fields (`is_...`, boolean)

```
is_show_clean_finish_reason_supported
is_re_segment_supported
is_video_monitor_supported
is_any_state_transit_goto_supported
is_fw_filter_obstacle_supported
is_video_setting_supported
is_ignore_unknown_map_object_supported
is_set_child_supported
is_carpet_supported
is_record_allowed
is_mop_path_supported
is_multi_map_segment_timer_supported
is_current_map_restore_enabled
is_room_name_supported
is_shake_mop_set_supported
is_map_beautify_internal_debug_supported
is_new_data_for_clean_history
is_new_data_for_clean_history_detail
is_flow_led_setting_supported
is_dust_collection_setting_supported
is_rpc_retry_supported
is_avoid_collision_supported
is_support_set_switch_map_mode
is_map_carpet_add_support
is_custom_water_box_distance_supported
```

#### Group B fields (`is_...`, boolean)

```
is_support_smart_scene
is_support_floor_edit
is_support_furniture
is_wash_then_charge_cmd_supported
is_support_room_tag
is_support_quick_map_builder
is_support_smart_global_clean_with_custom_mode
is_careful_slow_mop_supported
is_egg_mode_supported_from_new_features
is_carpet_show_on_map
is_supported_valley_electricity
is_unsave_map_reason_supported
is_supported_drying
is_supported_download_test_voice
is_support_backup_map
is_support_custom_mode_in_cleaning
is_support_remote_control_in_call
```

#### Group C fields (`is_...`, boolean)

```
is_support_set_volume_in_call
is_support_clean_estimate
is_support_custom_dnd
is_carpet_deep_clean_supported
is_support_stuck_zone
is_support_custom_door_sill
is_wifi_manage_supported
is_clean_route_fast_mode_supported
is_support_cliff_zone
is_support_smart_door_sill
is_support_floor_direction
is_back_charge_auto_wash_supported
is_support_incremental_map
is_offline_map_supported
is_super_deep_wash_supported
is_ces_2022_supported
is_dss_believable
is_main_brush_up_down_supported_from_str
is_goto_pure_clean_path_supported
is_water_up_down_drain_supported
is_setting_carpet_first_supported
is_clean_route_deep_slow_plus_supported
is_dynamically_skip_clean_zone_supported
is_dynamically_add_clean_zones_supported
is_left_water_drain_supported
is_clean_count_setting_supported
is_corner_clean_mode_supported
```

#### Group D fields (`is_...`, boolean) — one per NewFeatureStrBit member

```
is_two_key_real_time_video_supported
is_two_key_rtv_in_charging_supported
is_dirty_replenish_clean_supported
is_auto_delivery_field_in_global_status_supported
is_avoid_collision_mode_supported
is_voice_control_supported
is_new_endpoint_supported
is_pumping_water_supported
is_corner_mop_stretch_supported
is_hot_wash_towel_supported
is_floor_dir_clean_any_time_supported
is_pet_supplies_deep_clean_supported
is_mop_shake_water_max_supported
is_exact_custom_mode_supported
is_video_patrol_supported
is_carpet_custom_clean_supported
is_pet_snapshot_supported
is_custom_clean_mode_count_supported
is_new_ai_recognition_supported
is_auto_collection_2_supported
is_right_brush_stretch_supported
is_smart_clean_mode_set_supported
is_dirty_object_detect_supported
is_no_need_carpet_press_set_supported
is_voice_control_led_supported
is_water_leak_check_supported
is_min_battery_15_to_clean_task_supported
is_gap_deep_clean_supported
is_object_detect_check_supported
is_identify_room_supported
is_matter_supported
is_workday_holiday_supported
is_clean_direct_status_supported
is_map_eraser_supported
is_optimize_battery_supported
is_activate_video_charging_and_standby_supported
is_carpet_long_haired_supported
is_clean_history_time_line_supported
is_max_zone_opened_supported
is_exhibition_function_supported
is_lds_lifting_supported
is_auto_tear_down_mop_supported
is_small_side_mop_supported
is_support_side_brush_up_down_supported
is_dry_interval_timer_supported
is_uvc_sterilize_supported
is_midway_back_to_dock_supported
is_support_main_brush_up_down_supported
is_egg_dance_mode_supported
is_mechanical_arm_mode_supported
is_tidyup_zones_supported
is_clean_time_line_supported
is_clean_then_mop_mode_supported
is_type_identify_supported
is_support_get_particular_status_supported
is_three_d_mapping_inner_test_supported
is_sync_server_name_supported
is_should_show_arm_over_load_supported
is_collect_dust_count_show_supported
is_support_api_app_stop_grasp_supported
is_ctm_with_repeat_supported
is_side_brush_lift_carpet_supported
is_detect_wire_carpet_supported
is_water_slide_mode_supported
is_soak_and_wash_supported
is_clean_efficiency_supported
is_back_wash_new_smart_supported
is_dual_band_wi_fi_supported
is_program_mode_supported
is_clean_fluid_delivery_supported
is_carpet_long_haired_ex_supported
is_over_sea_ctm_supported
is_full_duples_switch_supported
is_low_area_access_supported
is_follow_low_obs_supported
is_two_gears_no_collision_supported
is_carpet_shape_type_supported
is_sr_map_supported
```

#### Group E fields (always `false` in this decoder)

```
is_led_status_switch_supported
is_multi_floor_supported
is_support_fetch_timer_summary
is_order_clean_supported
is_analysis_supported
is_remote_supported
is_support_voice_control_debug
```

#### Group F fields (always `false` in this decoder)

```
is_mop_forbidden_supported
is_soft_clean_mode_supported
is_custom_mode_supported
is_support_custom_carpet
is_show_general_obstacle_supported
is_show_obstacle_photo_supported
is_rubber_brush_carpet_supported
is_carpet_pressure_use_origin_paras_supported
is_support_mop_back_pwm_set
is_collect_dust_mode_supported
```

#### Group G fields (always `false` in this decoder)

```
is_support_water_mode
is_pure_clean_mop_supported
is_new_remote_view_supported
is_max_plus_mode_supported
is_none_pure_clean_mop_with_max_plus
is_clean_route_setting_supported
is_mop_shake_module_supported
is_customized_clean_supported
```

#### Raw diagnostic fields

```typescript
newFeatureInfo: bigint;   // parsed 64-bit value from featureSet; default 0n
newFeatureInfoStr: string; // raw newFeatureSet string; default ""
featureInfo: number[];    // always [] — requires APP_GET_INIT_STATUS data
```

---

### Step 2 — Implement private helper `extractNibbleBit`

```typescript
function extractNibbleBit(hexStr: string, bitIndex: number): boolean
```

Logic:

1. `nibblePos = Math.floor(bitIndex / 4)` — which nibble from the right
2. `bitPos = bitIndex % 4` — which bit within that nibble
3. `charIndex = hexStr.length - 1 - nibblePos`
4. If `charIndex < 0`, return `false`
5. `nibbleVal = parseInt(hexStr[charIndex], 16)`
6. If `isNaN(nibbleVal)`, return `false`
7. Return `(nibbleVal >> bitPos & 1) === 1`

---

### Step 3 — Implement public `decodeFeatureSet` function

Signature:

```typescript
export function decodeFeatureSet(featureSet?: string, newFeatureSet?: string): DeviceFeatures
```

**Parse inputs:**

```typescript
const featureInt: bigint = featureSet ? BigInt(featureSet) : 0n;
const lower32: number = Number(featureInt & 0xFFFFFFFFn);
const upper32: number = Number((featureInt >> 32n) & 0xFFFFFFFFn);
const hexStr: string = newFeatureSet ?? '';
const maskC: number = hexStr.length >= 8 ? parseInt(hexStr.slice(-8), 16) : 0;
```

**Decode Group A** — `(lower32 & MASK) !== 0`:

| Field                                      | Mask         |
| ------------------------------------------ | ------------ |
| `is_show_clean_finish_reason_supported`    | `1`          |
| `is_re_segment_supported`                  | `4`          |
| `is_video_monitor_supported`               | `8`          |
| `is_any_state_transit_goto_supported`      | `16`         |
| `is_fw_filter_obstacle_supported`          | `32`         |
| `is_video_setting_supported`               | `64`         |
| `is_ignore_unknown_map_object_supported`   | `128`        |
| `is_set_child_supported`                   | `256`        |
| `is_carpet_supported`                      | `512`        |
| `is_record_allowed`                        | `1024`       |
| `is_mop_path_supported`                    | `2048`       |
| `is_multi_map_segment_timer_supported`     | `4096`       |
| `is_current_map_restore_enabled`           | `8192`       |
| `is_room_name_supported`                   | `16384`      |
| `is_shake_mop_set_supported`               | `262144`     |
| `is_map_beautify_internal_debug_supported` | `2097152`    |
| `is_new_data_for_clean_history`            | `4194304`    |
| `is_new_data_for_clean_history_detail`     | `8388608`    |
| `is_flow_led_setting_supported`            | `16777216`   |
| `is_dust_collection_setting_supported`     | `33554432`   |
| `is_rpc_retry_supported`                   | `67108864`   |
| `is_avoid_collision_supported`             | `134217728`  |
| `is_support_set_switch_map_mode`           | `268435456`  |
| `is_map_carpet_add_support`                | `1073741824` |
| `is_custom_water_box_distance_supported`   | `2147483648` |

Note: masks `1073741824` and `2147483648` are 2^30 and 2^31. JavaScript bitwise operators work on signed 32-bit integers, so `lower32 & 2147483648` may produce a negative result. Use `(lower32 & 2147483648) !== 0` — this is safe because `!== 0` is used, not `=== mask`.

**Decode Group B** — `(upper32 >> BIT_INDEX & 1) === 1`:

| Field                                            | Bit index |
| ------------------------------------------------ | --------- |
| `is_support_smart_scene`                         | `1`       |
| `is_support_floor_edit`                          | `3`       |
| `is_support_furniture`                           | `4`       |
| `is_wash_then_charge_cmd_supported`              | `5`       |
| `is_support_room_tag`                            | `6`       |
| `is_support_quick_map_builder`                   | `7`       |
| `is_support_smart_global_clean_with_custom_mode` | `8`       |
| `is_careful_slow_mop_supported`                  | `9`       |
| `is_egg_mode_supported_from_new_features`        | `10`      |
| `is_carpet_show_on_map`                          | `12`      |
| `is_supported_valley_electricity`                | `13`      |
| `is_unsave_map_reason_supported`                 | `14`      |
| `is_supported_drying`                            | `15`      |
| `is_supported_download_test_voice`               | `16`      |
| `is_support_backup_map`                          | `17`      |
| `is_support_custom_mode_in_cleaning`             | `18`      |
| `is_support_remote_control_in_call`              | `19`      |

**Decode Group C** — `(maskC & MASK) !== 0`:

| Field                                      | Mask         |
| ------------------------------------------ | ------------ |
| `is_support_set_volume_in_call`            | `1`          |
| `is_support_clean_estimate`                | `2`          |
| `is_support_custom_dnd`                    | `4`          |
| `is_carpet_deep_clean_supported`           | `8`          |
| `is_support_stuck_zone`                    | `16`         |
| `is_support_custom_door_sill`              | `32`         |
| `is_wifi_manage_supported`                 | `128`        |
| `is_clean_route_fast_mode_supported`       | `256`        |
| `is_support_cliff_zone`                    | `512`        |
| `is_support_smart_door_sill`               | `1024`       |
| `is_support_floor_direction`               | `2048`       |
| `is_back_charge_auto_wash_supported`       | `4096`       |
| `is_support_incremental_map`               | `4194304`    |
| `is_offline_map_supported`                 | `16384`      |
| `is_super_deep_wash_supported`             | `32768`      |
| `is_ces_2022_supported`                    | `65536`      |
| `is_dss_believable`                        | `131072`     |
| `is_main_brush_up_down_supported_from_str` | `262144`     |
| `is_goto_pure_clean_path_supported`        | `524288`     |
| `is_water_up_down_drain_supported`         | `1048576`    |
| `is_setting_carpet_first_supported`        | `8388608`    |
| `is_clean_route_deep_slow_plus_supported`  | `16777216`   |
| `is_dynamically_skip_clean_zone_supported` | `33554432`   |
| `is_dynamically_add_clean_zones_supported` | `67108864`   |
| `is_left_water_drain_supported`            | `134217728`  |
| `is_clean_count_setting_supported`         | `1073741824` |
| `is_corner_clean_mode_supported`           | `2147483648` |

Same signed-32-bit caveat for masks >= 2^31 — use `!== 0`.

**Decode Group D** — `extractNibbleBit(hexStr, BIT_INDEX)`:

| Field                                               | Bit index (`NewFeatureStrBit` value)               |
| --------------------------------------------------- | -------------------------------------------------- |
| `is_two_key_real_time_video_supported`              | `32`                                               |
| `is_two_key_rtv_in_charging_supported`              | `33`                                               |
| `is_dirty_replenish_clean_supported`                | `34`                                               |
| `is_auto_delivery_field_in_global_status_supported` | `35`                                               |
| `is_avoid_collision_mode_supported`                 | `36`                                               |
| `is_voice_control_supported`                        | `37`                                               |
| `is_new_endpoint_supported`                         | `38`                                               |
| `is_pumping_water_supported`                        | `39`                                               |
| `is_corner_mop_stretch_supported`                   | `40`                                               |
| `is_hot_wash_towel_supported`                       | `41`                                               |
| `is_floor_dir_clean_any_time_supported`             | `42`                                               |
| `is_pet_supplies_deep_clean_supported`              | `43`                                               |
| `is_mop_shake_water_max_supported`                  | `45`                                               |
| `is_exact_custom_mode_supported`                    | `47`                                               |
| `is_video_patrol_supported`                         | `48`                                               |
| `is_carpet_custom_clean_supported`                  | `49`                                               |
| `is_pet_snapshot_supported`                         | `50`                                               |
| `is_custom_clean_mode_count_supported`              | `51`                                               |
| `is_new_ai_recognition_supported`                   | `52`                                               |
| `is_auto_collection_2_supported`                    | `53`                                               |
| `is_right_brush_stretch_supported`                  | `54`                                               |
| `is_smart_clean_mode_set_supported`                 | `55`                                               |
| `is_dirty_object_detect_supported`                  | `56`                                               |
| `is_no_need_carpet_press_set_supported`             | `57`                                               |
| `is_voice_control_led_supported`                    | `58`                                               |
| `is_water_leak_check_supported`                     | `60`                                               |
| `is_min_battery_15_to_clean_task_supported`         | `62`                                               |
| `is_gap_deep_clean_supported`                       | `63`                                               |
| `is_object_detect_check_supported`                  | `64`                                               |
| `is_identify_room_supported`                        | `66`                                               |
| `is_matter_supported`                               | `67`                                               |
| `is_workday_holiday_supported`                      | `69`                                               |
| `is_clean_direct_status_supported`                  | `70`                                               |
| `is_map_eraser_supported`                           | `71`                                               |
| `is_optimize_battery_supported`                     | `72`                                               |
| `is_activate_video_charging_and_standby_supported`  | `73`                                               |
| `is_carpet_long_haired_supported`                   | `75`                                               |
| `is_clean_history_time_line_supported`              | `76`                                               |
| `is_max_zone_opened_supported`                      | `77`                                               |
| `is_exhibition_function_supported`                  | `78`                                               |
| `is_lds_lifting_supported`                          | `79`                                               |
| `is_auto_tear_down_mop_supported`                   | `80`                                               |
| `is_small_side_mop_supported`                       | `81`                                               |
| `is_support_side_brush_up_down_supported`           | `82`                                               |
| `is_dry_interval_timer_supported`                   | `83`                                               |
| `is_uvc_sterilize_supported`                        | `84`                                               |
| `is_midway_back_to_dock_supported`                  | `85`                                               |
| `is_support_main_brush_up_down_supported`           | `86`                                               |
| `is_egg_dance_mode_supported`                       | `87`                                               |
| `is_mechanical_arm_mode_supported`                  | `89`                                               |
| `is_tidyup_zones_supported`                         | `89` (same bit as above — both decode identically) |
| `is_clean_time_line_supported`                      | `91`                                               |
| `is_clean_then_mop_mode_supported`                  | `93`                                               |
| `is_type_identify_supported`                        | `94`                                               |
| `is_support_get_particular_status_supported`        | `96`                                               |
| `is_three_d_mapping_inner_test_supported`           | `97`                                               |
| `is_sync_server_name_supported`                     | `98`                                               |
| `is_should_show_arm_over_load_supported`            | `99`                                               |
| `is_collect_dust_count_show_supported`              | `100`                                              |
| `is_support_api_app_stop_grasp_supported`           | `101`                                              |
| `is_ctm_with_repeat_supported`                      | `102`                                              |
| `is_side_brush_lift_carpet_supported`               | `104`                                              |
| `is_detect_wire_carpet_supported`                   | `105`                                              |
| `is_water_slide_mode_supported`                     | `106`                                              |
| `is_soak_and_wash_supported`                        | `107`                                              |
| `is_clean_efficiency_supported`                     | `108`                                              |
| `is_back_wash_new_smart_supported`                  | `109`                                              |
| `is_dual_band_wi_fi_supported`                      | `110`                                              |
| `is_program_mode_supported`                         | `111`                                              |
| `is_clean_fluid_delivery_supported`                 | `112`                                              |
| `is_carpet_long_haired_ex_supported`                | `113`                                              |
| `is_over_sea_ctm_supported`                         | `114`                                              |
| `is_full_duples_switch_supported`                   | `115`                                              |
| `is_low_area_access_supported`                      | `116`                                              |
| `is_follow_low_obs_supported`                       | `117`                                              |
| `is_two_gears_no_collision_supported`               | `118`                                              |
| `is_carpet_shape_type_supported`                    | `119`                                              |
| `is_sr_map_supported`                               | `120`                                              |

**Groups E, F, G** — all set to `false`.

**Raw diagnostics:**

```typescript
newFeatureInfo: featureInt,
newFeatureInfoStr: hexStr,
featureInfo: [],
```

**Return** the fully constructed `DeviceFeatures` object literal.

---

### Step 4 — Guard against invalid input

Wrap `BigInt(featureSet)` in a try/catch — return all-false `DeviceFeatures` (with `newFeatureInfo: 0n`, `newFeatureInfoStr: ''`, `featureInfo: []`) if parsing throws.

Similarly, if `parseInt(hexStr.slice(-8), 16)` returns `NaN`, treat `maskC` as `0`.

---

## Constraints

- No imports from any other project file — this is a pure utility
- All boolean fields use `boolean` type (not `boolean | undefined`)
- `newFeatureInfo` uses type `bigint`
- `featureInfo` uses type `readonly number[]` or `number[]`
- All field names must exactly match the names listed above (they mirror Python snake_case directly)
- File must use `export` for both `DeviceFeatures` and `decodeFeatureSet`
- No default exports — named exports only
- The `extractNibbleBit` helper is not exported (module-private)
- Use `const` for all local variables
- Follow existing `share/` file style: no classes, no side effects, pure functions

---

## Test Strategy

Test file: `src/tests/share/featureSetDecoder.test.ts`

### Cases to cover

1. **`decodeFeatureSet()` with no arguments** — all boolean fields `false`, raw fields at defaults (`0n`, `''`, `[]`)

2. **Group A — single-bit featureSet strings**
   - `featureSet = '1'` → `is_show_clean_finish_reason_supported: true`, all others false
   - `featureSet = '2147483648'` (2^31) → `is_custom_water_box_distance_supported: true`
   - `featureSet = '1073741824'` (2^30) → `is_map_carpet_add_support: true`

3. **Group B — featureSet upper 32 bits**
   - `featureSet = '4294967296'` (2^32, bit 0 of upper) → all Group B false (bit 0 not mapped)
   - `featureSet = '8589934592'` (2^33, bit 1 of upper) → `is_support_smart_scene: true`
   - `featureSet = String(BigInt(3) << BigInt(35))` (bit 3 of upper) → `is_support_floor_edit: true`

4. **Group C — newFeatureSet last 8 hex chars**
   - `newFeatureSet = '00000001'` → `is_support_set_volume_in_call: true`
   - `newFeatureSet = '80000000'` (2^31 in hex) → `is_corner_clean_mode_supported: true`
   - `newFeatureSet = 'FFFF00000001'` (more than 8 chars, only last 8 matter) → `is_support_set_volume_in_call: true`

5. **Group D — nibble-index extraction**
   - `newFeatureSet` with bit 32 set: nibble 8 from right, bit 0 → `is_two_key_real_time_video_supported: true`
   - `newFeatureSet` with bit 89 set → both `is_mechanical_arm_mode_supported: true` and `is_tidyup_zones_supported: true`
   - `newFeatureSet` with bit 120 set (index 120, nibble 30 from right) → `is_sr_map_supported: true`

6. **Groups E, F, G** — always `false` regardless of inputs

7. **Raw diagnostic fields**
   - `featureSet = '12345'` → `newFeatureInfo: 12345n`
   - `newFeatureSet = 'ABCD'` → `newFeatureInfoStr: 'ABCD'`
   - `featureInfo` always `[]`

8. **Invalid inputs**
   - `featureSet = 'not-a-number'` → does not throw; all booleans `false`
   - `newFeatureSet = ''` → all Group C and D fields `false`
   - `newFeatureSet` shorter than 8 chars → `maskC` derived from available chars

9. **Combined — multiple bits set simultaneously**
   - `featureSet` with both lower and upper bits set → both Group A and Group B fields decode correctly

---

## Status

ready
