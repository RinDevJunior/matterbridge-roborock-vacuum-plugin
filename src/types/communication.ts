import type { NotifyMessageTypes } from '../notifyMessageTypes.js';
export type DeviceNotifyCallback = (messageSource: NotifyMessageTypes, homeData: unknown) => Promise<void>;
