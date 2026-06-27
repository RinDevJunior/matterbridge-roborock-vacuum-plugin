export interface DeviceFeatures {
	// Group A — lower 32 bits of featureSet
	is_show_clean_finish_reason_supported: boolean;
	is_re_segment_supported: boolean;
	is_video_monitor_supported: boolean;
	is_any_state_transit_goto_supported: boolean;
	is_fw_filter_obstacle_supported: boolean;
	is_video_setting_supported: boolean;
	is_ignore_unknown_map_object_supported: boolean;
	is_set_child_supported: boolean;
	is_carpet_supported: boolean;
	is_record_allowed: boolean;
	is_mop_path_supported: boolean;
	is_multi_map_segment_timer_supported: boolean;
	is_current_map_restore_enabled: boolean;
	is_room_name_supported: boolean;
	is_shake_mop_set_supported: boolean;
	is_map_beautify_internal_debug_supported: boolean;
	is_new_data_for_clean_history: boolean;
	is_new_data_for_clean_history_detail: boolean;
	is_flow_led_setting_supported: boolean;
	is_dust_collection_setting_supported: boolean;
	is_rpc_retry_supported: boolean;
	is_avoid_collision_supported: boolean;
	is_support_set_switch_map_mode: boolean;
	is_map_carpet_add_support: boolean;
	is_custom_water_box_distance_supported: boolean;

	// Group B — upper 32 bits of featureSet
	is_support_smart_scene: boolean;
	is_support_floor_edit: boolean;
	is_support_furniture: boolean;
	is_wash_then_charge_cmd_supported: boolean;
	is_support_room_tag: boolean;
	is_support_quick_map_builder: boolean;
	is_support_smart_global_clean_with_custom_mode: boolean;
	is_careful_slow_mop_supported: boolean;
	is_egg_mode_supported_from_new_features: boolean;
	is_carpet_show_on_map: boolean;
	is_supported_valley_electricity: boolean;
	is_unsave_map_reason_supported: boolean;
	is_supported_drying: boolean;
	is_supported_download_test_voice: boolean;
	is_support_backup_map: boolean;
	is_support_custom_mode_in_cleaning: boolean;
	is_support_remote_control_in_call: boolean;

	// Group C — last 8 hex chars of newFeatureSet
	is_support_set_volume_in_call: boolean;
	is_support_clean_estimate: boolean;
	is_support_custom_dnd: boolean;
	is_carpet_deep_clean_supported: boolean;
	is_support_stuck_zone: boolean;
	is_support_custom_door_sill: boolean;
	is_wifi_manage_supported: boolean;
	is_clean_route_fast_mode_supported: boolean;
	is_support_cliff_zone: boolean;
	is_support_smart_door_sill: boolean;
	is_support_floor_direction: boolean;
	is_back_charge_auto_wash_supported: boolean;
	is_support_incremental_map: boolean;
	is_offline_map_supported: boolean;
	is_super_deep_wash_supported: boolean;
	is_ces_2022_supported: boolean;
	is_dss_believable: boolean;
	is_main_brush_up_down_supported_from_str: boolean;
	is_goto_pure_clean_path_supported: boolean;
	is_water_up_down_drain_supported: boolean;
	is_setting_carpet_first_supported: boolean;
	is_clean_route_deep_slow_plus_supported: boolean;
	is_dynamically_skip_clean_zone_supported: boolean;
	is_dynamically_add_clean_zones_supported: boolean;
	is_left_water_drain_supported: boolean;
	is_clean_count_setting_supported: boolean;
	is_corner_clean_mode_supported: boolean;

	// Group D — nibble-index extraction from newFeatureSet (NewFeatureStrBit members)
	is_two_key_real_time_video_supported: boolean;
	is_two_key_rtv_in_charging_supported: boolean;
	is_dirty_replenish_clean_supported: boolean;
	is_auto_delivery_field_in_global_status_supported: boolean;
	is_avoid_collision_mode_supported: boolean;
	is_voice_control_supported: boolean;
	is_new_endpoint_supported: boolean;
	is_pumping_water_supported: boolean;
	is_corner_mop_stretch_supported: boolean;
	is_hot_wash_towel_supported: boolean;
	is_floor_dir_clean_any_time_supported: boolean;
	is_pet_supplies_deep_clean_supported: boolean;
	is_mop_shake_water_max_supported: boolean;
	is_exact_custom_mode_supported: boolean;
	is_video_patrol_supported: boolean;
	is_carpet_custom_clean_supported: boolean;
	is_pet_snapshot_supported: boolean;
	is_custom_clean_mode_count_supported: boolean;
	is_new_ai_recognition_supported: boolean;
	is_auto_collection_2_supported: boolean;
	is_right_brush_stretch_supported: boolean;
	is_smart_clean_mode_set_supported: boolean;
	is_dirty_object_detect_supported: boolean;
	is_no_need_carpet_press_set_supported: boolean;
	is_voice_control_led_supported: boolean;
	is_water_leak_check_supported: boolean;
	is_min_battery_15_to_clean_task_supported: boolean;
	is_gap_deep_clean_supported: boolean;
	is_object_detect_check_supported: boolean;
	is_identify_room_supported: boolean;
	is_matter_supported: boolean;
	is_workday_holiday_supported: boolean;
	is_clean_direct_status_supported: boolean;
	is_map_eraser_supported: boolean;
	is_optimize_battery_supported: boolean;
	is_activate_video_charging_and_standby_supported: boolean;
	is_carpet_long_haired_supported: boolean;
	is_clean_history_time_line_supported: boolean;
	is_max_zone_opened_supported: boolean;
	is_exhibition_function_supported: boolean;
	is_lds_lifting_supported: boolean;
	is_auto_tear_down_mop_supported: boolean;
	is_small_side_mop_supported: boolean;
	is_support_side_brush_up_down_supported: boolean;
	is_dry_interval_timer_supported: boolean;
	is_uvc_sterilize_supported: boolean;
	is_midway_back_to_dock_supported: boolean;
	is_support_main_brush_up_down_supported: boolean;
	is_egg_dance_mode_supported: boolean;
	is_mechanical_arm_mode_supported: boolean;
	is_tidyup_zones_supported: boolean;
	is_clean_time_line_supported: boolean;
	is_clean_then_mop_mode_supported: boolean;
	is_type_identify_supported: boolean;
	is_support_get_particular_status_supported: boolean;
	is_three_d_mapping_inner_test_supported: boolean;
	is_sync_server_name_supported: boolean;
	is_should_show_arm_over_load_supported: boolean;
	is_collect_dust_count_show_supported: boolean;
	is_support_api_app_stop_grasp_supported: boolean;
	is_ctm_with_repeat_supported: boolean;
	is_side_brush_lift_carpet_supported: boolean;
	is_detect_wire_carpet_supported: boolean;
	is_water_slide_mode_supported: boolean;
	is_soak_and_wash_supported: boolean;
	is_clean_efficiency_supported: boolean;
	is_back_wash_new_smart_supported: boolean;
	is_dual_band_wi_fi_supported: boolean;
	is_program_mode_supported: boolean;
	is_clean_fluid_delivery_supported: boolean;
	is_carpet_long_haired_ex_supported: boolean;
	is_over_sea_ctm_supported: boolean;
	is_full_duples_switch_supported: boolean;
	is_low_area_access_supported: boolean;
	is_follow_low_obs_supported: boolean;
	is_two_gears_no_collision_supported: boolean;
	is_carpet_shape_type_supported: boolean;
	is_sr_map_supported: boolean;

	// Group E — robot_features (requires APP_GET_INIT_STATUS; always false in this decoder)
	is_led_status_switch_supported: boolean;
	is_multi_floor_supported: boolean;
	is_support_fetch_timer_summary: boolean;
	is_order_clean_supported: boolean;
	is_analysis_supported: boolean;
	is_remote_supported: boolean;
	is_support_voice_control_debug: boolean;

	// Group F — model_whitelist/blacklist (always false in this decoder)
	is_mop_forbidden_supported: boolean;
	is_soft_clean_mode_supported: boolean;
	is_custom_mode_supported: boolean;
	is_support_custom_carpet: boolean;
	is_show_general_obstacle_supported: boolean;
	is_show_obstacle_photo_supported: boolean;
	is_rubber_brush_carpet_supported: boolean;
	is_carpet_pressure_use_origin_paras_supported: boolean;
	is_support_mop_back_pwm_set: boolean;
	is_collect_dust_mode_supported: boolean;

	// Group G — product_features (always false in this decoder)
	is_support_water_mode: boolean;
	is_pure_clean_mop_supported: boolean;
	is_new_remote_view_supported: boolean;
	is_max_plus_mode_supported: boolean;
	is_none_pure_clean_mop_with_max_plus: boolean;
	is_clean_route_setting_supported: boolean;
	is_mop_shake_module_supported: boolean;
	is_customized_clean_supported: boolean;

	// Raw diagnostic fields
	newFeatureInfo: bigint;
	newFeatureInfoStr: string;
	featureInfo: number[];
}

function extractNibbleBit(hexStr: string, bitIndex: number): boolean {
	const nibblePos = Math.floor(bitIndex / 4);
	const bitPos = bitIndex % 4;
	const charIndex = hexStr.length - 1 - nibblePos;
	if (charIndex < 0) return false;
	const nibbleVal = parseInt(hexStr[charIndex], 16);
	if (isNaN(nibbleVal)) return false;
	return ((nibbleVal >> bitPos) & 1) === 1;
}

function buildAllFalse(): DeviceFeatures {
	return {
		is_show_clean_finish_reason_supported: false,
		is_re_segment_supported: false,
		is_video_monitor_supported: false,
		is_any_state_transit_goto_supported: false,
		is_fw_filter_obstacle_supported: false,
		is_video_setting_supported: false,
		is_ignore_unknown_map_object_supported: false,
		is_set_child_supported: false,
		is_carpet_supported: false,
		is_record_allowed: false,
		is_mop_path_supported: false,
		is_multi_map_segment_timer_supported: false,
		is_current_map_restore_enabled: false,
		is_room_name_supported: false,
		is_shake_mop_set_supported: false,
		is_map_beautify_internal_debug_supported: false,
		is_new_data_for_clean_history: false,
		is_new_data_for_clean_history_detail: false,
		is_flow_led_setting_supported: false,
		is_dust_collection_setting_supported: false,
		is_rpc_retry_supported: false,
		is_avoid_collision_supported: false,
		is_support_set_switch_map_mode: false,
		is_map_carpet_add_support: false,
		is_custom_water_box_distance_supported: false,
		is_support_smart_scene: false,
		is_support_floor_edit: false,
		is_support_furniture: false,
		is_wash_then_charge_cmd_supported: false,
		is_support_room_tag: false,
		is_support_quick_map_builder: false,
		is_support_smart_global_clean_with_custom_mode: false,
		is_careful_slow_mop_supported: false,
		is_egg_mode_supported_from_new_features: false,
		is_carpet_show_on_map: false,
		is_supported_valley_electricity: false,
		is_unsave_map_reason_supported: false,
		is_supported_drying: false,
		is_supported_download_test_voice: false,
		is_support_backup_map: false,
		is_support_custom_mode_in_cleaning: false,
		is_support_remote_control_in_call: false,
		is_support_set_volume_in_call: false,
		is_support_clean_estimate: false,
		is_support_custom_dnd: false,
		is_carpet_deep_clean_supported: false,
		is_support_stuck_zone: false,
		is_support_custom_door_sill: false,
		is_wifi_manage_supported: false,
		is_clean_route_fast_mode_supported: false,
		is_support_cliff_zone: false,
		is_support_smart_door_sill: false,
		is_support_floor_direction: false,
		is_back_charge_auto_wash_supported: false,
		is_support_incremental_map: false,
		is_offline_map_supported: false,
		is_super_deep_wash_supported: false,
		is_ces_2022_supported: false,
		is_dss_believable: false,
		is_main_brush_up_down_supported_from_str: false,
		is_goto_pure_clean_path_supported: false,
		is_water_up_down_drain_supported: false,
		is_setting_carpet_first_supported: false,
		is_clean_route_deep_slow_plus_supported: false,
		is_dynamically_skip_clean_zone_supported: false,
		is_dynamically_add_clean_zones_supported: false,
		is_left_water_drain_supported: false,
		is_clean_count_setting_supported: false,
		is_corner_clean_mode_supported: false,
		is_two_key_real_time_video_supported: false,
		is_two_key_rtv_in_charging_supported: false,
		is_dirty_replenish_clean_supported: false,
		is_auto_delivery_field_in_global_status_supported: false,
		is_avoid_collision_mode_supported: false,
		is_voice_control_supported: false,
		is_new_endpoint_supported: false,
		is_pumping_water_supported: false,
		is_corner_mop_stretch_supported: false,
		is_hot_wash_towel_supported: false,
		is_floor_dir_clean_any_time_supported: false,
		is_pet_supplies_deep_clean_supported: false,
		is_mop_shake_water_max_supported: false,
		is_exact_custom_mode_supported: false,
		is_video_patrol_supported: false,
		is_carpet_custom_clean_supported: false,
		is_pet_snapshot_supported: false,
		is_custom_clean_mode_count_supported: false,
		is_new_ai_recognition_supported: false,
		is_auto_collection_2_supported: false,
		is_right_brush_stretch_supported: false,
		is_smart_clean_mode_set_supported: false,
		is_dirty_object_detect_supported: false,
		is_no_need_carpet_press_set_supported: false,
		is_voice_control_led_supported: false,
		is_water_leak_check_supported: false,
		is_min_battery_15_to_clean_task_supported: false,
		is_gap_deep_clean_supported: false,
		is_object_detect_check_supported: false,
		is_identify_room_supported: false,
		is_matter_supported: false,
		is_workday_holiday_supported: false,
		is_clean_direct_status_supported: false,
		is_map_eraser_supported: false,
		is_optimize_battery_supported: false,
		is_activate_video_charging_and_standby_supported: false,
		is_carpet_long_haired_supported: false,
		is_clean_history_time_line_supported: false,
		is_max_zone_opened_supported: false,
		is_exhibition_function_supported: false,
		is_lds_lifting_supported: false,
		is_auto_tear_down_mop_supported: false,
		is_small_side_mop_supported: false,
		is_support_side_brush_up_down_supported: false,
		is_dry_interval_timer_supported: false,
		is_uvc_sterilize_supported: false,
		is_midway_back_to_dock_supported: false,
		is_support_main_brush_up_down_supported: false,
		is_egg_dance_mode_supported: false,
		is_mechanical_arm_mode_supported: false,
		is_tidyup_zones_supported: false,
		is_clean_time_line_supported: false,
		is_clean_then_mop_mode_supported: false,
		is_type_identify_supported: false,
		is_support_get_particular_status_supported: false,
		is_three_d_mapping_inner_test_supported: false,
		is_sync_server_name_supported: false,
		is_should_show_arm_over_load_supported: false,
		is_collect_dust_count_show_supported: false,
		is_support_api_app_stop_grasp_supported: false,
		is_ctm_with_repeat_supported: false,
		is_side_brush_lift_carpet_supported: false,
		is_detect_wire_carpet_supported: false,
		is_water_slide_mode_supported: false,
		is_soak_and_wash_supported: false,
		is_clean_efficiency_supported: false,
		is_back_wash_new_smart_supported: false,
		is_dual_band_wi_fi_supported: false,
		is_program_mode_supported: false,
		is_clean_fluid_delivery_supported: false,
		is_carpet_long_haired_ex_supported: false,
		is_over_sea_ctm_supported: false,
		is_full_duples_switch_supported: false,
		is_low_area_access_supported: false,
		is_follow_low_obs_supported: false,
		is_two_gears_no_collision_supported: false,
		is_carpet_shape_type_supported: false,
		is_sr_map_supported: false,
		is_led_status_switch_supported: false,
		is_multi_floor_supported: false,
		is_support_fetch_timer_summary: false,
		is_order_clean_supported: false,
		is_analysis_supported: false,
		is_remote_supported: false,
		is_support_voice_control_debug: false,
		is_mop_forbidden_supported: false,
		is_soft_clean_mode_supported: false,
		is_custom_mode_supported: false,
		is_support_custom_carpet: false,
		is_show_general_obstacle_supported: false,
		is_show_obstacle_photo_supported: false,
		is_rubber_brush_carpet_supported: false,
		is_carpet_pressure_use_origin_paras_supported: false,
		is_support_mop_back_pwm_set: false,
		is_collect_dust_mode_supported: false,
		is_support_water_mode: false,
		is_pure_clean_mop_supported: false,
		is_new_remote_view_supported: false,
		is_max_plus_mode_supported: false,
		is_none_pure_clean_mop_with_max_plus: false,
		is_clean_route_setting_supported: false,
		is_mop_shake_module_supported: false,
		is_customized_clean_supported: false,
		newFeatureInfo: 0n,
		newFeatureInfoStr: '',
		featureInfo: [],
	};
}

export function decodeFeatureSet(featureSet?: string, newFeatureSet?: string): DeviceFeatures {
	let featureInt: bigint;
	try {
		featureInt = featureSet ? BigInt(featureSet) : 0n;
	} catch {
		return buildAllFalse();
	}

	const lower32 = Number(featureInt & 0xffffffffn);
	const upper32 = Number((featureInt >> 32n) & 0xffffffffn);
	const hexStr = newFeatureSet ?? '';
	const rawMaskC = hexStr.length >= 8 ? parseInt(hexStr.slice(-8), 16) : 0;
	const maskC = isNaN(rawMaskC) ? 0 : rawMaskC;

	return {
		// Group A
		is_show_clean_finish_reason_supported: (lower32 & 1) !== 0,
		is_re_segment_supported: (lower32 & 4) !== 0,
		is_video_monitor_supported: (lower32 & 8) !== 0,
		is_any_state_transit_goto_supported: (lower32 & 16) !== 0,
		is_fw_filter_obstacle_supported: (lower32 & 32) !== 0,
		is_video_setting_supported: (lower32 & 64) !== 0,
		is_ignore_unknown_map_object_supported: (lower32 & 128) !== 0,
		is_set_child_supported: (lower32 & 256) !== 0,
		is_carpet_supported: (lower32 & 512) !== 0,
		is_record_allowed: (lower32 & 1024) !== 0,
		is_mop_path_supported: (lower32 & 2048) !== 0,
		is_multi_map_segment_timer_supported: (lower32 & 4096) !== 0,
		is_current_map_restore_enabled: (lower32 & 8192) !== 0,
		is_room_name_supported: (lower32 & 16384) !== 0,
		is_shake_mop_set_supported: (lower32 & 262144) !== 0,
		is_map_beautify_internal_debug_supported: (lower32 & 2097152) !== 0,
		is_new_data_for_clean_history: (lower32 & 4194304) !== 0,
		is_new_data_for_clean_history_detail: (lower32 & 8388608) !== 0,
		is_flow_led_setting_supported: (lower32 & 16777216) !== 0,
		is_dust_collection_setting_supported: (lower32 & 33554432) !== 0,
		is_rpc_retry_supported: (lower32 & 67108864) !== 0,
		is_avoid_collision_supported: (lower32 & 134217728) !== 0,
		is_support_set_switch_map_mode: (lower32 & 268435456) !== 0,
		is_map_carpet_add_support: (lower32 & 1073741824) !== 0,
		is_custom_water_box_distance_supported: (lower32 & 2147483648) !== 0,

		// Group B
		is_support_smart_scene: ((upper32 >> 1) & 1) === 1,
		is_support_floor_edit: ((upper32 >> 3) & 1) === 1,
		is_support_furniture: ((upper32 >> 4) & 1) === 1,
		is_wash_then_charge_cmd_supported: ((upper32 >> 5) & 1) === 1,
		is_support_room_tag: ((upper32 >> 6) & 1) === 1,
		is_support_quick_map_builder: ((upper32 >> 7) & 1) === 1,
		is_support_smart_global_clean_with_custom_mode: ((upper32 >> 8) & 1) === 1,
		is_careful_slow_mop_supported: ((upper32 >> 9) & 1) === 1,
		is_egg_mode_supported_from_new_features: ((upper32 >> 10) & 1) === 1,
		is_carpet_show_on_map: ((upper32 >> 12) & 1) === 1,
		is_supported_valley_electricity: ((upper32 >> 13) & 1) === 1,
		is_unsave_map_reason_supported: ((upper32 >> 14) & 1) === 1,
		is_supported_drying: ((upper32 >> 15) & 1) === 1,
		is_supported_download_test_voice: ((upper32 >> 16) & 1) === 1,
		is_support_backup_map: ((upper32 >> 17) & 1) === 1,
		is_support_custom_mode_in_cleaning: ((upper32 >> 18) & 1) === 1,
		is_support_remote_control_in_call: ((upper32 >> 19) & 1) === 1,

		// Group C
		is_support_set_volume_in_call: (maskC & 1) !== 0,
		is_support_clean_estimate: (maskC & 2) !== 0,
		is_support_custom_dnd: (maskC & 4) !== 0,
		is_carpet_deep_clean_supported: (maskC & 8) !== 0,
		is_support_stuck_zone: (maskC & 16) !== 0,
		is_support_custom_door_sill: (maskC & 32) !== 0,
		is_wifi_manage_supported: (maskC & 128) !== 0,
		is_clean_route_fast_mode_supported: (maskC & 256) !== 0,
		is_support_cliff_zone: (maskC & 512) !== 0,
		is_support_smart_door_sill: (maskC & 1024) !== 0,
		is_support_floor_direction: (maskC & 2048) !== 0,
		is_back_charge_auto_wash_supported: (maskC & 4096) !== 0,
		is_support_incremental_map: (maskC & 4194304) !== 0,
		is_offline_map_supported: (maskC & 16384) !== 0,
		is_super_deep_wash_supported: (maskC & 32768) !== 0,
		is_ces_2022_supported: (maskC & 65536) !== 0,
		is_dss_believable: (maskC & 131072) !== 0,
		is_main_brush_up_down_supported_from_str: (maskC & 262144) !== 0,
		is_goto_pure_clean_path_supported: (maskC & 524288) !== 0,
		is_water_up_down_drain_supported: (maskC & 1048576) !== 0,
		is_setting_carpet_first_supported: (maskC & 8388608) !== 0,
		is_clean_route_deep_slow_plus_supported: (maskC & 16777216) !== 0,
		is_dynamically_skip_clean_zone_supported: (maskC & 33554432) !== 0,
		is_dynamically_add_clean_zones_supported: (maskC & 67108864) !== 0,
		is_left_water_drain_supported: (maskC & 134217728) !== 0,
		is_clean_count_setting_supported: (maskC & 1073741824) !== 0,
		is_corner_clean_mode_supported: (maskC & 2147483648) !== 0,

		// Group D
		is_two_key_real_time_video_supported: extractNibbleBit(hexStr, 32),
		is_two_key_rtv_in_charging_supported: extractNibbleBit(hexStr, 33),
		is_dirty_replenish_clean_supported: extractNibbleBit(hexStr, 34),
		is_auto_delivery_field_in_global_status_supported: extractNibbleBit(hexStr, 35),
		is_avoid_collision_mode_supported: extractNibbleBit(hexStr, 36),
		is_voice_control_supported: extractNibbleBit(hexStr, 37),
		is_new_endpoint_supported: extractNibbleBit(hexStr, 38),
		is_pumping_water_supported: extractNibbleBit(hexStr, 39),
		is_corner_mop_stretch_supported: extractNibbleBit(hexStr, 40),
		is_hot_wash_towel_supported: extractNibbleBit(hexStr, 41),
		is_floor_dir_clean_any_time_supported: extractNibbleBit(hexStr, 42),
		is_pet_supplies_deep_clean_supported: extractNibbleBit(hexStr, 43),
		is_mop_shake_water_max_supported: extractNibbleBit(hexStr, 45),
		is_exact_custom_mode_supported: extractNibbleBit(hexStr, 47),
		is_video_patrol_supported: extractNibbleBit(hexStr, 48),
		is_carpet_custom_clean_supported: extractNibbleBit(hexStr, 49),
		is_pet_snapshot_supported: extractNibbleBit(hexStr, 50),
		is_custom_clean_mode_count_supported: extractNibbleBit(hexStr, 51),
		is_new_ai_recognition_supported: extractNibbleBit(hexStr, 52),
		is_auto_collection_2_supported: extractNibbleBit(hexStr, 53),
		is_right_brush_stretch_supported: extractNibbleBit(hexStr, 54),
		is_smart_clean_mode_set_supported: extractNibbleBit(hexStr, 55),
		is_dirty_object_detect_supported: extractNibbleBit(hexStr, 56),
		is_no_need_carpet_press_set_supported: extractNibbleBit(hexStr, 57),
		is_voice_control_led_supported: extractNibbleBit(hexStr, 58),
		is_water_leak_check_supported: extractNibbleBit(hexStr, 60),
		is_min_battery_15_to_clean_task_supported: extractNibbleBit(hexStr, 62),
		is_gap_deep_clean_supported: extractNibbleBit(hexStr, 63),
		is_object_detect_check_supported: extractNibbleBit(hexStr, 64),
		is_identify_room_supported: extractNibbleBit(hexStr, 66),
		is_matter_supported: extractNibbleBit(hexStr, 67),
		is_workday_holiday_supported: extractNibbleBit(hexStr, 69),
		is_clean_direct_status_supported: extractNibbleBit(hexStr, 70),
		is_map_eraser_supported: extractNibbleBit(hexStr, 71),
		is_optimize_battery_supported: extractNibbleBit(hexStr, 72),
		is_activate_video_charging_and_standby_supported: extractNibbleBit(hexStr, 73),
		is_carpet_long_haired_supported: extractNibbleBit(hexStr, 75),
		is_clean_history_time_line_supported: extractNibbleBit(hexStr, 76),
		is_max_zone_opened_supported: extractNibbleBit(hexStr, 77),
		is_exhibition_function_supported: extractNibbleBit(hexStr, 78),
		is_lds_lifting_supported: extractNibbleBit(hexStr, 79),
		is_auto_tear_down_mop_supported: extractNibbleBit(hexStr, 80),
		is_small_side_mop_supported: extractNibbleBit(hexStr, 81),
		is_support_side_brush_up_down_supported: extractNibbleBit(hexStr, 82),
		is_dry_interval_timer_supported: extractNibbleBit(hexStr, 83),
		is_uvc_sterilize_supported: extractNibbleBit(hexStr, 84),
		is_midway_back_to_dock_supported: extractNibbleBit(hexStr, 85),
		is_support_main_brush_up_down_supported: extractNibbleBit(hexStr, 86),
		is_egg_dance_mode_supported: extractNibbleBit(hexStr, 87),
		is_mechanical_arm_mode_supported: extractNibbleBit(hexStr, 89),
		is_tidyup_zones_supported: extractNibbleBit(hexStr, 89),
		is_clean_time_line_supported: extractNibbleBit(hexStr, 91),
		is_clean_then_mop_mode_supported: extractNibbleBit(hexStr, 93),
		is_type_identify_supported: extractNibbleBit(hexStr, 94),
		is_support_get_particular_status_supported: extractNibbleBit(hexStr, 96),
		is_three_d_mapping_inner_test_supported: extractNibbleBit(hexStr, 97),
		is_sync_server_name_supported: extractNibbleBit(hexStr, 98),
		is_should_show_arm_over_load_supported: extractNibbleBit(hexStr, 99),
		is_collect_dust_count_show_supported: extractNibbleBit(hexStr, 100),
		is_support_api_app_stop_grasp_supported: extractNibbleBit(hexStr, 101),
		is_ctm_with_repeat_supported: extractNibbleBit(hexStr, 102),
		is_side_brush_lift_carpet_supported: extractNibbleBit(hexStr, 104),
		is_detect_wire_carpet_supported: extractNibbleBit(hexStr, 105),
		is_water_slide_mode_supported: extractNibbleBit(hexStr, 106),
		is_soak_and_wash_supported: extractNibbleBit(hexStr, 107),
		is_clean_efficiency_supported: extractNibbleBit(hexStr, 108),
		is_back_wash_new_smart_supported: extractNibbleBit(hexStr, 109),
		is_dual_band_wi_fi_supported: extractNibbleBit(hexStr, 110),
		is_program_mode_supported: extractNibbleBit(hexStr, 111),
		is_clean_fluid_delivery_supported: extractNibbleBit(hexStr, 112),
		is_carpet_long_haired_ex_supported: extractNibbleBit(hexStr, 113),
		is_over_sea_ctm_supported: extractNibbleBit(hexStr, 114),
		is_full_duples_switch_supported: extractNibbleBit(hexStr, 115),
		is_low_area_access_supported: extractNibbleBit(hexStr, 116),
		is_follow_low_obs_supported: extractNibbleBit(hexStr, 117),
		is_two_gears_no_collision_supported: extractNibbleBit(hexStr, 118),
		is_carpet_shape_type_supported: extractNibbleBit(hexStr, 119),
		is_sr_map_supported: extractNibbleBit(hexStr, 120),

		// Groups E, F, G — always false (require data not available to this decoder)
		is_led_status_switch_supported: false,
		is_multi_floor_supported: false,
		is_support_fetch_timer_summary: false,
		is_order_clean_supported: false,
		is_analysis_supported: false,
		is_remote_supported: false,
		is_support_voice_control_debug: false,
		is_mop_forbidden_supported: false,
		is_soft_clean_mode_supported: false,
		is_custom_mode_supported: false,
		is_support_custom_carpet: false,
		is_show_general_obstacle_supported: false,
		is_show_obstacle_photo_supported: false,
		is_rubber_brush_carpet_supported: false,
		is_carpet_pressure_use_origin_paras_supported: false,
		is_support_mop_back_pwm_set: false,
		is_collect_dust_mode_supported: false,
		is_support_water_mode: false,
		is_pure_clean_mop_supported: false,
		is_new_remote_view_supported: false,
		is_max_plus_mode_supported: false,
		is_none_pure_clean_mop_with_max_plus: false,
		is_clean_route_setting_supported: false,
		is_mop_shake_module_supported: false,
		is_customized_clean_supported: false,

		// Raw diagnostic fields
		newFeatureInfo: featureInt,
		newFeatureInfoStr: hexStr,
		featureInfo: [],
	};
}
