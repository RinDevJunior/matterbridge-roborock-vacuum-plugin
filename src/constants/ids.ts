/**
 * ID-related constants for areas, scenes, and segments.
 * @module constants/ids
 */

/**
 * Minimum area ID for scenes/routines.
 * Scene IDs start at 5000 to avoid conflicts with room IDs (1-4999).
 */
export const SCENE_AREA_ID_MIN = 5000;

/**
 * Maximum area ID for scenes/routines.
 * Scene IDs range from 5000 to 9000.
 */
export const SCENE_AREA_ID_MAX = 9000;

/**
 * Sentinel value representing an invalid or unknown segment ID.
 */
export const INVALID_SEGMENT_ID = -1;

/**
 * Offset applied to area IDs for each additional map in multi-map scenarios.
 * Each map's room IDs are offset by this value times the map index.
 */
export const MULTIPLE_MAP_AREA_ID_OFFSET = 100;

/**
 * Default area ID used when the actual area is unknown.
 */
export const DEFAULT_AREA_ID_UNKNOWN = 1;

/**
 * Area ID for error cases.
 */
export const DEFAULT_AREA_ID_ERROR = 2;

/**
 * Minimum value for randomly generated room IDs.
 */
export const RANDOM_ROOM_MIN = 1000;

/**
 * Maximum value for randomly generated room IDs.
 */
export const RANDOM_ROOM_MAX = 9999;

/**
 * Area ID for "whole house" cleaning (no specific room selected).
 */
export const AREA_ID_WHOLE_HOUSE = 0;
