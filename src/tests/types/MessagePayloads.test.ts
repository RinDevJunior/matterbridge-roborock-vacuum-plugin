import { expect, test } from 'vitest';
import {
  isLocalMessage,
  isCloudMessage,
  isHomeData,
  isBatteryUpdate,
  isErrorOccurred,
  LocalMessagePayload,
  CloudMessagePayload,
  HomeDataPayload,
  BatteryUpdatePayload,
  ErrorOccurredPayload,
} from '../../types/MessagePayloads.js';
import { NotifyMessageTypes } from '../../types/notifyMessageTypes.js';
import { asPartial } from '../helpers/testUtils.js';

test('MessagePayloads type-guards', () => {
  const local: LocalMessagePayload = { type: NotifyMessageTypes.LocalMessage, data: asPartial({}), duid: 'd' };
  const cloud: CloudMessagePayload = { type: NotifyMessageTypes.CloudMessage, data: asPartial({}), duid: 'd' };
  const home: HomeDataPayload = { type: NotifyMessageTypes.HomeData, data: asPartial({}) };
  const battery: BatteryUpdatePayload = { type: NotifyMessageTypes.BatteryUpdate, data: { duid: 'd', percentage: 50 } };
  const error: ErrorOccurredPayload = { type: NotifyMessageTypes.ErrorOccurred, data: { duid: 'd', errorCode: 42 } };

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
