/**
 * Device-related constants including model lists and capabilities.
 * @module constants/device
 */

import { DeviceModel } from '../roborockCommunication/Zmodel/deviceModel.js';

/**
 * Set of device models that support smart planning features.
 * These models have advanced clean mode capabilities and extended feature sets.
 */
export const SMART_MODELS = new Set<string>([DeviceModel.QREVO_EDGE_5V1, DeviceModel.QREVO_PLUS]);

/**
 * Default delay for unregistering devices on shutdown (milliseconds).
 */
export const UNREGISTER_DEVICES_DELAY_MS = 500;
