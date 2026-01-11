/**
 * Communication and message type definitions.
 * @module types/communication
 */

import type { NotifyMessageTypes } from '../notifyMessageTypes.js';

/**
 * Callback function for device notification events.
 * Called when device status changes or messages are received.
 *
 * @param messageSource - Type of message (cloud, local, error, battery update)
 * @param homeData - Device data payload (type varies by message source)
 *
 * @example
 * ```typescript
 * const deviceNotifyCallback: DeviceNotifyCallback = async (source, data) => {
 *   if (source === NotifyMessageTypes.BatteryUpdate) {
 *     console.log('Battery:', (data as BatteryMessage).percentage);
 *   }
 * };
 * ```
 */
export type DeviceNotifyCallback = (messageSource: NotifyMessageTypes, homeData: unknown) => Promise<void>;
