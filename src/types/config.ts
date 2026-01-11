/**
 * Configuration and service initialization type definitions.
 * @module types/config
 */

/**
 * Connection and polling configuration constants.
 */
export interface ServiceConfig {
  /** Delay in milliseconds between connection retry attempts */
  readonly connectionRetryDelayMs: number;
  /** Maximum number of connection attempts before giving up */
  readonly maxConnectionAttempts: number;
  /** Multiplier for MQTT refresh interval (applied to base refresh interval) */
  readonly mqttRefreshIntervalMultiplier: number;
  /** Multiplier for local network refresh interval (applied to base refresh interval) */
  readonly localRefreshIntervalMultiplier: number;
}

/**
 * Default service configuration values.
 */
export const DEFAULT_SERVICE_CONFIG: ServiceConfig = {
  connectionRetryDelayMs: 500,
  maxConnectionAttempts: 20,
  mqttRefreshIntervalMultiplier: 500,
  localRefreshIntervalMultiplier: 1000,
};
