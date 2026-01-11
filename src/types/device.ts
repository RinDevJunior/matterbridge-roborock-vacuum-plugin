/**
 * Device-specific type definitions for internal communication.
 * @module types/device
 */

/**
 * Response structure for map room queries.
 * Contains the current room the vacuum is located in.
 */
export interface MapRoomResponse {
  /** The current room ID where the vacuum is located, or undefined if not in a specific room */
  vacuumRoom?: number;
}

/**
 * Security context for authenticated message requests.
 * Used in protocol-level secure communication.
 */
export interface Security {
  /** Cryptographic nonce for request authentication */
  nonce: number;
}
