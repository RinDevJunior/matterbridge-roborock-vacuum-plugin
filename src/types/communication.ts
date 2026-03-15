import type { MessagePayload } from './MessagePayloads.js';

export type DeviceNotifyCallback = (payload: MessagePayload) => Promise<void>;
