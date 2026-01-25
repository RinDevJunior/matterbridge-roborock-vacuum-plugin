/**
 * Port interface for device communication.
 * Defines the contract for sending commands and receiving status updates from devices.
 */
export interface IDeviceGateway {
  /**
   * Send a command to a device.
   */
  sendCommand(duid: string, command: DeviceCommand): Promise<void>;

  /**
   * Get the current status of a device.
   */
  getStatus(duid: string): Promise<DeviceStatus>;

  /**
   * Subscribe to status updates from a device.
   */
  subscribe(duid: string, callback: StatusCallback): () => void;
}

/**
 * Device command structure.
 */
export interface DeviceCommand {
  method: string;
  params: unknown[];
}

/**
 * Device status structure.
 */
export interface DeviceStatus {
  state: string;
  battery: number;
  [key: string]: unknown;
}

/**
 * Callback for device status updates.
 */
export type StatusCallback = (status: DeviceStatus) => void;
