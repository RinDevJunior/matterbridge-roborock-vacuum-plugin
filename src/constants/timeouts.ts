/**
 * Timeout and interval constants for network operations.
 * @module constants/timeouts
 */

/**
 * Delay before manual reconnect is triggered if MQTT auto-reconnect fails (30 seconds).
 */
export const MANUAL_RECONNECT_DELAY_MS = 30000;

/**
 * Timeout for synchronous message requests (10 seconds).
 * If no response is received within this time, the request fails.
 */
export const MESSAGE_TIMEOUT_MS = 10000;

/**
 * Delay before attempting to reconnect after disconnection (10 seconds).
 */
export const RECONNECT_DELAY_MS = 10000;

/**
 * Interval for MQTT keepalive messages (60 minutes).
 * Prevents connection timeout on idle connections.
 */
export const KEEPALIVE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Minimum time between verification code requests (15 minutes).
 * Rate limiting for 2FA code generation.
 */
export const VERIFICATION_CODE_RATE_LIMIT_MS = 15 * 60 * 1000;

/**
 * Default refresh interval for home data requests (60 seconds).
 */
export const DEFAULT_REFRESH_INTERVAL_SECONDS = 60;

/**
 * Small buffer added to refresh interval to prevent timing conflicts (100ms).
 */
export const REFRESH_INTERVAL_BUFFER_MS = 100;

/**
 * Maximum retry count for failed connections.
 */
export const MAX_RETRY_COUNT = 10;

/**
 * Timeout for hello/ping response from device (10 seconds).
 */
export const HELLO_RESPONSE_TIMEOUT_MS = 10000;

/**
 * Delay between connection retry attempts (500ms).
 */
export const CONNECTION_RETRY_DELAY_MS = 1000;

/**
 * Maximum number of connection attempts before timeout (20 attempts).
 */
export const MAX_CONNECTION_ATTEMPTS = 30;

/**
 * Multiplier for MQTT refresh interval (500ms).
 */
export const MQTT_REFRESH_INTERVAL_MULTIPLIER = 500;

/**
 * Multiplier for local network refresh interval (1000ms).
 */
export const LOCAL_REFRESH_INTERVAL_MULTIPLIER = 1000;

/**
 * Number of consecutive failures before entering backoff mode (5 failures).
 */
export const FAILURE_THRESHOLD = 5;

/**
 * Backoff delay after consecutive failures (30 minutes).
 */
export const BACKOFF_DELAY_MS = 30 * 60 * 1000;
