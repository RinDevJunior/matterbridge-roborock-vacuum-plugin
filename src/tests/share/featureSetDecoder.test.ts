import { describe, expect, it } from 'vitest';

import { decodeFeatureSet } from '../../share/featureSetDecoder.js';

describe('decodeFeatureSet', () => {
	describe('golden test with device a187 data', () => {
		it('should decode real device data (a187) with expected flag values', () => {
			const result = decodeFeatureSet('2247397454282751', '00000000082834C1C2FA8F5C7EDEFFFE');

			// Group A — lower32 = 0xFEEE7FFF
			expect(result.is_show_clean_finish_reason_supported).toBe(true);
			expect(result.is_re_segment_supported).toBe(true);
			expect(result.is_video_monitor_supported).toBe(true);
			expect(result.is_any_state_transit_goto_supported).toBe(true);
			expect(result.is_fw_filter_obstacle_supported).toBe(true);
			expect(result.is_video_setting_supported).toBe(true);
			expect(result.is_ignore_unknown_map_object_supported).toBe(true);
			expect(result.is_set_child_supported).toBe(true);
			expect(result.is_carpet_supported).toBe(true);
			expect(result.is_record_allowed).toBe(true);
			expect(result.is_mop_path_supported).toBe(true);
			expect(result.is_multi_map_segment_timer_supported).toBe(true);
			expect(result.is_current_map_restore_enabled).toBe(true);
			expect(result.is_room_name_supported).toBe(true);
			expect(result.is_flow_led_setting_supported).toBe(false);
			expect(result.is_dust_collection_setting_supported).toBe(true);
			expect(result.is_support_set_switch_map_mode).toBe(true);
			expect(result.is_map_carpet_add_support).toBe(true);
			expect(result.is_custom_water_box_distance_supported).toBe(true);

			// Group B — upper32 = 0x7FBFE
			expect(result.is_support_smart_scene).toBe(true);
			expect(result.is_support_floor_edit).toBe(true);
			expect(result.is_support_furniture).toBe(true);
			expect(result.is_wash_then_charge_cmd_supported).toBe(true);
			expect(result.is_support_room_tag).toBe(true);
			expect(result.is_support_quick_map_builder).toBe(true);
			expect(result.is_support_smart_global_clean_with_custom_mode).toBe(true);
			expect(result.is_careful_slow_mop_supported).toBe(true);
			expect(result.is_egg_mode_supported_from_new_features).toBe(false);
			expect(result.is_carpet_show_on_map).toBe(true);
			expect(result.is_supported_valley_electricity).toBe(true);
			expect(result.is_unsave_map_reason_supported).toBe(true);
			expect(result.is_supported_drying).toBe(true);
			expect(result.is_supported_download_test_voice).toBe(true);
			expect(result.is_support_backup_map).toBe(true);
			expect(result.is_support_custom_mode_in_cleaning).toBe(true);
			expect(result.is_support_remote_control_in_call).toBe(false);

			// Group C — last 8 hex chars = "7EDEFFFE" = 0x7EDEFFFE
			expect(result.is_support_set_volume_in_call).toBe(false);
			expect(result.is_support_clean_estimate).toBe(true);
			expect(result.is_support_custom_dnd).toBe(true);
			expect(result.is_carpet_deep_clean_supported).toBe(true);
			expect(result.is_support_stuck_zone).toBe(true);
			expect(result.is_support_custom_door_sill).toBe(true);
			expect(result.is_wifi_manage_supported).toBe(true);
			expect(result.is_clean_route_fast_mode_supported).toBe(true);
			expect(result.is_support_cliff_zone).toBe(true);
			expect(result.is_support_smart_door_sill).toBe(true);
			expect(result.is_support_floor_direction).toBe(true);
			expect(result.is_back_charge_auto_wash_supported).toBe(true);
			expect(result.is_support_incremental_map).toBe(true);
			expect(result.is_offline_map_supported).toBe(true);
			expect(result.is_super_deep_wash_supported).toBe(true);
			expect(result.is_ces_2022_supported).toBe(false);
			expect(result.is_dss_believable).toBe(true);
			expect(result.is_main_brush_up_down_supported_from_str).toBe(true);
			expect(result.is_goto_pure_clean_path_supported).toBe(true);
			expect(result.is_water_up_down_drain_supported).toBe(true);
			expect(result.is_setting_carpet_first_supported).toBe(true);
			expect(result.is_clean_route_deep_slow_plus_supported).toBe(false);
			expect(result.is_dynamically_skip_clean_zone_supported).toBe(true);
			expect(result.is_dynamically_add_clean_zones_supported).toBe(true);
			expect(result.is_left_water_drain_supported).toBe(true);
			expect(result.is_clean_count_setting_supported).toBe(true);
			expect(result.is_corner_clean_mode_supported).toBe(false);

			// Group D — selected nibble-extracted bits from newFeatureSet
			expect(result.is_two_key_real_time_video_supported).toBe(false);
			expect(result.is_two_key_rtv_in_charging_supported).toBe(false);
			expect(result.is_dirty_replenish_clean_supported).toBe(true);
			expect(result.is_auto_delivery_field_in_global_status_supported).toBe(true);
			expect(result.is_avoid_collision_mode_supported).toBe(true);
			expect(result.is_voice_control_supported).toBe(false);
			expect(result.is_new_endpoint_supported).toBe(true);
			expect(result.is_pumping_water_supported).toBe(false);
			expect(result.is_corner_mop_stretch_supported).toBe(true);
			expect(result.is_hot_wash_towel_supported).toBe(true);
			expect(result.is_floor_dir_clean_any_time_supported).toBe(true);
			expect(result.is_pet_supplies_deep_clean_supported).toBe(true);
			expect(result.is_mop_shake_water_max_supported).toBe(false);
			expect(result.is_exact_custom_mode_supported).toBe(true);
			expect(result.is_video_patrol_supported).toBe(false);
			expect(result.is_carpet_custom_clean_supported).toBe(true);
			expect(result.is_pet_snapshot_supported).toBe(false);
			expect(result.is_custom_clean_mode_count_supported).toBe(true);
			expect(result.is_new_ai_recognition_supported).toBe(true);
			expect(result.is_auto_collection_2_supported).toBe(true);
			expect(result.is_right_brush_stretch_supported).toBe(true);
			expect(result.is_smart_clean_mode_set_supported).toBe(true);
			expect(result.is_dirty_object_detect_supported).toBe(false);
			expect(result.is_no_need_carpet_press_set_supported).toBe(true);
			expect(result.is_voice_control_led_supported).toBe(false);
			expect(result.is_water_leak_check_supported).toBe(false);
			expect(result.is_min_battery_15_to_clean_task_supported).toBe(true);
			expect(result.is_gap_deep_clean_supported).toBe(true);
			expect(result.is_object_detect_check_supported).toBe(true);
			expect(result.is_identify_room_supported).toBe(false);
			expect(result.is_matter_supported).toBe(false);
			expect(result.is_workday_holiday_supported).toBe(false);
			expect(result.is_clean_direct_status_supported).toBe(true);
			expect(result.is_map_eraser_supported).toBe(true);
			expect(result.is_optimize_battery_supported).toBe(false);
			expect(result.is_activate_video_charging_and_standby_supported).toBe(false);
			expect(result.is_carpet_long_haired_supported).toBe(false);
			expect(result.is_clean_history_time_line_supported).toBe(true);
			expect(result.is_max_zone_opened_supported).toBe(true);
			expect(result.is_exhibition_function_supported).toBe(false);
			expect(result.is_lds_lifting_supported).toBe(false);
			expect(result.is_auto_tear_down_mop_supported).toBe(false);
			expect(result.is_small_side_mop_supported).toBe(false);
			expect(result.is_support_side_brush_up_down_supported).toBe(false);
			expect(result.is_dry_interval_timer_supported).toBe(true);
			expect(result.is_uvc_sterilize_supported).toBe(false);
			expect(result.is_midway_back_to_dock_supported).toBe(true);
			expect(result.is_support_main_brush_up_down_supported).toBe(false);
			expect(result.is_egg_dance_mode_supported).toBe(false);
			expect(result.is_mechanical_arm_mode_supported).toBe(false);
			expect(result.is_tidyup_zones_supported).toBe(false);
			expect(result.is_clean_time_line_supported).toBe(true);
			expect(result.is_clean_then_mop_mode_supported).toBe(false);
			expect(result.is_type_identify_supported).toBe(false);

			// Raw diagnostic fields
			expect(result.newFeatureInfo).toBe(BigInt('2247397454282751'));
			expect(result.newFeatureInfoStr).toBe('00000000082834C1C2FA8F5C7EDEFFFE');
			expect(result.featureInfo).toEqual([]);
		});
	});

	describe('edge cases', () => {
		it('should return all-false result when called with no arguments', () => {
			const result = decodeFeatureSet();

			expect(result.is_show_clean_finish_reason_supported).toBe(false);
			expect(result.is_re_segment_supported).toBe(false);
			expect(result.is_support_smart_scene).toBe(false);
			expect(result.is_clean_then_mop_mode_supported).toBe(false);
			expect(result.newFeatureInfo).toBe(0n);
			expect(result.newFeatureInfoStr).toBe('');
			expect(result.featureInfo).toEqual([]);
		});

		it('should return all-false result with invalid featureSet string', () => {
			const result = decodeFeatureSet('not-a-number', '00000000082834C1C2FA8F5C7EDEFFFE');

			expect(result.is_show_clean_finish_reason_supported).toBe(false);
			expect(result.is_video_monitor_supported).toBe(false);
			expect(result.is_support_smart_scene).toBe(false);
			expect(result.newFeatureInfo).toBe(0n);
			expect(result.newFeatureInfoStr).toBe('');
			expect(result.featureInfo).toEqual([]);
		});

		it('should return all-false result when both featureSet and newFeatureSet are zero/empty', () => {
			const result = decodeFeatureSet('0', '');

			expect(result.is_show_clean_finish_reason_supported).toBe(false);
			expect(result.is_support_smart_scene).toBe(false);
			expect(result.is_support_clean_estimate).toBe(false);
			expect(result.is_dirty_replenish_clean_supported).toBe(false);
			expect(result.newFeatureInfo).toBe(0n);
			expect(result.newFeatureInfoStr).toBe('');
			expect(result.featureInfo).toEqual([]);
		});

		it('should handle featureSet without newFeatureSet', () => {
			const result = decodeFeatureSet('2247397454282751');

			expect(result.newFeatureInfo).toBe(BigInt('2247397454282751'));
			expect(result.newFeatureInfoStr).toBe('');
			expect(result.featureInfo).toEqual([]);
			// Group A/B should decode from featureSet
			expect(result.is_show_clean_finish_reason_supported).toBe(true);
			expect(result.is_support_smart_scene).toBe(true);
			// Group D should all be false (no newFeatureSet)
			expect(result.is_dirty_replenish_clean_supported).toBe(false);
			expect(result.is_clean_then_mop_mode_supported).toBe(false);
		});

		it('should handle newFeatureSet without featureSet', () => {
			const result = decodeFeatureSet(undefined, '00000000082834C1C2FA8F5C7EDEFFFE');

			expect(result.newFeatureInfo).toBe(0n);
			expect(result.newFeatureInfoStr).toBe('00000000082834C1C2FA8F5C7EDEFFFE');
			expect(result.featureInfo).toEqual([]);
			// Group A/B should be false (no featureSet)
			expect(result.is_show_clean_finish_reason_supported).toBe(false);
			expect(result.is_support_smart_scene).toBe(false);
			// Group D should decode from newFeatureSet
			expect(result.is_dirty_replenish_clean_supported).toBe(true);
			expect(result.is_clean_then_mop_mode_supported).toBe(false);
		});

		it('should handle malformed newFeatureSet gracefully (shorter than 8 chars)', () => {
			const result = decodeFeatureSet('2247397454282751', 'ABCD');

			expect(result.newFeatureInfo).toBe(BigInt('2247397454282751'));
			expect(result.newFeatureInfoStr).toBe('ABCD');
			expect(result.featureInfo).toEqual([]);
			// Group C should be 0 (hex string too short to extract last 8 chars)
			expect(result.is_support_set_volume_in_call).toBe(false);
			expect(result.is_support_clean_estimate).toBe(false);
		});

		it('should handle non-hex characters in newFeatureSet gracefully', () => {
			const result = decodeFeatureSet('2247397454282751', '00000000XXXXXXXX');

			expect(result.newFeatureInfo).toBe(BigInt('2247397454282751'));
			expect(result.newFeatureInfoStr).toBe('00000000XXXXXXXX');
			// Group C extraction should treat invalid hex as 0
			expect(result.is_support_set_volume_in_call).toBe(false);
			expect(result.is_support_clean_estimate).toBe(false);
		});
	});
});
