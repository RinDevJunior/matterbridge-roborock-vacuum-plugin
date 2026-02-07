/**
 * Discriminated union types for message payloads.
 * Provides type-safe message handling in runtime processors.
 * @module types/MessagePayloads
 */

import { NotifyMessageTypes } from './notifyMessageTypes.js';
import { CleanInformation, Home } from '../roborockCommunication/models/index.js';
import { OperationStatusCode } from '../roborockCommunication/enums/operationStatusCode.js';

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
    chargeStatus: number | undefined;
    deviceStatus: number | undefined;
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
 * Device status message payload.
 * Contains complete device status from status change notifications.
 */
export interface DeviceStatusPayload {
  type: NotifyMessageTypes.DeviceStatus;
  data: {
    duid: string;
    status: OperationStatusCode;
    inCleaning: boolean | undefined;
    inReturning: boolean | undefined;
    inFreshState: boolean | undefined;
    isLocating: boolean | undefined;
    isExploring: boolean | undefined;
    inWarmup: boolean | undefined;
  };
}

/**
 * Simple device status message payload.
 * Contains only status code from home data API for devices without real-time connection.
 */
export interface DeviceStatusSimplePayload {
  type: NotifyMessageTypes.DeviceStatusSimple;
  data: {
    duid: string;
    status: OperationStatusCode;
  };
}

/**
 * Clean mode update message payload.
 * Contains clean mode settings (suction power, water flow, mop route).
 */
export interface CleanModeUpdatePayload {
  type: NotifyMessageTypes.CleanModeUpdate;
  data: {
    duid: string;
    suctionPower: number;
    waterFlow: number;
    distance_off: number;
    mopRoute: number | undefined;
  };
}

/**
 * Service area update message payload.
 * Contains service area and map updates (supported areas, maps, selected areas, current area).
 */
export interface ServiceAreaUpdatePayload {
  type: NotifyMessageTypes.ServiceAreaUpdate;
  data: {
    duid: string;
    state: OperationStatusCode;
    cleaningInfo: CleanInformation | undefined;
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
 *     case NotifyMessageTypes.HomeData:
 *       // payload.data is Home
 *       processHomeData(payload.data);
 *       break;
 *   }
 * }
 * ```
 */
export type MessagePayload =
  | HomeDataPayload
  | BatteryUpdatePayload
  | ErrorOccurredPayload
  | DeviceStatusPayload
  | DeviceStatusSimplePayload
  | CleanModeUpdatePayload
  | ServiceAreaUpdatePayload;
