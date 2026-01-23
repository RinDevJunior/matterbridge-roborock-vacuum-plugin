/**
 * Discriminated union types for message payloads.
 * Provides type-safe message handling in runtime processors.
 * @module types/MessagePayloads
 */

import { CloudMessageModel } from '../model/CloudMessageModel.js';
import { NotifyMessageTypes } from '../notifyMessageTypes.js';
import { CloudMessageResult, Home } from '../roborockCommunication/models/index.js';

/**
 * Local network message payload.
 * Contains device status and state from direct UDP communication.
 */
export interface LocalMessagePayload {
  type: NotifyMessageTypes.LocalMessage;
  data: CloudMessageResult;
  duid: string;
}

/**
 * Cloud MQTT message payload.
 * Contains status updates from Roborock cloud service.
 */
export interface CloudMessagePayload {
  type: NotifyMessageTypes.CloudMessage;
  data: CloudMessageModel;
  duid: string;
}

/**
 * Home data message payload.
 * Contains complete home and device information from REST API.
 */
export interface HomeDataPayload {
  type: NotifyMessageTypes.HomeData;
  data: Home;
}

/**
 * Battery update message payload.
 * Contains battery percentage from device notifications.
 */
export interface BatteryUpdatePayload {
  type: NotifyMessageTypes.BatteryUpdate;
  data: {
    duid: string;
    percentage: number;
  };
}

/**
 * Error notification message payload.
 * Contains error codes and device identifier.
 */
export interface ErrorOccurredPayload {
  type: NotifyMessageTypes.ErrorOccurred;
  data: {
    duid: string;
    errorCode: number;
  };
}

/**
 * Discriminated union of all possible message payloads.
 * Enables type-safe message routing and handling.
 *
 * @example
 * ```typescript
 * function handleMessage(payload: MessagePayload) {
 *   switch (payload.type) {
 *     case NotifyMessageTypes.LocalMessage:
 *       // payload.data is CloudMessageResult
 *       processLocalMessage(payload.data, payload.duid);
 *       break;
 *     case NotifyMessageTypes.CloudMessage:
 *       // payload.data is CloudMessageModel
 *       processCloudMessage(payload.data, payload.duid);
 *       break;
 *     case NotifyMessageTypes.HomeData:
 *       // payload.data is Home
 *       processHomeData(payload.data);
 *       break;
 *   }
 * }
 * ```
 */
export type MessagePayload = LocalMessagePayload | CloudMessagePayload | HomeDataPayload | BatteryUpdatePayload | ErrorOccurredPayload;

/**
 * Type guard to check if a payload is a local message.
 */
export function isLocalMessage(payload: MessagePayload): payload is LocalMessagePayload {
  return payload.type === NotifyMessageTypes.LocalMessage;
}

/**
 * Type guard to check if a payload is a cloud message.
 */
export function isCloudMessage(payload: MessagePayload): payload is CloudMessagePayload {
  return payload.type === NotifyMessageTypes.CloudMessage;
}

/**
 * Type guard to check if a payload is home data.
 */
export function isHomeData(payload: MessagePayload): payload is HomeDataPayload {
  return payload.type === NotifyMessageTypes.HomeData;
}

/**
 * Type guard to check if a payload is a battery update.
 */
export function isBatteryUpdate(payload: MessagePayload): payload is BatteryUpdatePayload {
  return payload.type === NotifyMessageTypes.BatteryUpdate;
}

/**
 * Type guard to check if a payload is an error notification.
 */
export function isErrorOccurred(payload: MessagePayload): payload is ErrorOccurredPayload {
  return payload.type === NotifyMessageTypes.ErrorOccurred;
}
