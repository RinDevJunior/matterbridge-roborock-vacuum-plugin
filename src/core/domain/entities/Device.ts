/**
 * Domain entity representing a Roborock device.
 * This is a clean domain model focusing on core device properties.
 */
export interface DeviceEntity {
  /** Unique device identifier */
  readonly duid: string;

  /** Device name */
  readonly name: string;

  /** Serial number */
  readonly serialNumber: string;

  /** Device model */
  readonly model: string;

  /** Local encryption key */
  readonly localKey: string;

  /** Protocol version */
  readonly protocolVersion: string;

  /** Firmware version */
  readonly firmwareVersion: string;

  /** Product ID */
  readonly productId: string;

  /** Roborock Home ID */
  readonly homeId: number;

  /** Device online status */
  readonly isOnline: boolean;

  /** Active time (timestamp) */
  readonly activeTime: number;

  /** Creation time (timestamp) */
  readonly createTime: number;
}
