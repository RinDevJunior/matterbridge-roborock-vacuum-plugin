import { DeviceModel } from '../roborockCommunication/models/index.js';

/**
 * Set of device models that support smart planning features.
 * These models have advanced clean mode capabilities and extended feature sets.
 */
export const SMART_MODELS = new Set<string>([DeviceModel.QREVO_EDGE_5V1, DeviceModel.QREVO_PLUS, DeviceModel.QREVO_MAXV]);

/**
 * Default delay for unregistering devices on shutdown (milliseconds).
 */
export const UNREGISTER_DEVICES_DELAY_MS = 500;
