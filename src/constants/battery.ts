/**
 * Battery-related constants for vacuum cleaners.
 * @module constants/battery
 */

/**
 * Battery percentage threshold for "OK" status.
 * Battery is considered healthy above this level (>=70%).
 */
export const BATTERY_THRESHOLD_OK = 70;

/**
 * Battery percentage threshold for "WARNING" status.
 * Battery is considered low below this level (40-69%).
 */
export const BATTERY_THRESHOLD_WARNING = 40;

/**
 * Battery percentage representing full charge.
 */
export const BATTERY_FULL = 100;

/**
 * Percentage representing empty battery (0%).
 */
export const BATTERY_LEVEL_EMPTY = 0;

/**
 * Multiply battery percentage by 2 for Matter protocol representation.
 * Matter expects battery level in range 0-200 (0-100%).
 */
export const BATTERY_MATTER_MULTIPLIER = 2;
