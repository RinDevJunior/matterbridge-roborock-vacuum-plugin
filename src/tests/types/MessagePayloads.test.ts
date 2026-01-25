import { expect, test } from 'vitest';
import { isLocalMessage, isCloudMessage, isHomeData, isBatteryUpdate, isErrorOccurred } from '../../types/MessagePayloads.js';
import { NotifyMessageTypes } from '../../types/notifyMessageTypes.js';

test('MessagePayloads type-guards', () => {
  const local = { type: NotifyMessageTypes.LocalMessage, data: {}, duid: 'd' } as any;
  const cloud = { type: NotifyMessageTypes.CloudMessage, data: {}, duid: 'd' } as any;
  const home = { type: NotifyMessageTypes.HomeData, data: {} } as any;
  const battery = { type: NotifyMessageTypes.BatteryUpdate, data: { duid: 'd', percentage: 50 } } as any;
  const error = { type: NotifyMessageTypes.ErrorOccurred, data: { duid: 'd', errorCode: 42 } } as any;

  expect(isLocalMessage(local)).toBe(true);
  expect(isCloudMessage(cloud)).toBe(true);
  expect(isHomeData(home)).toBe(true);
  expect(isBatteryUpdate(battery)).toBe(true);
  expect(isErrorOccurred(error)).toBe(true);

  // negatives
  expect(isLocalMessage(cloud)).toBe(false);
  expect(isCloudMessage(local)).toBe(false);
  expect(isHomeData(battery)).toBe(false);
});
