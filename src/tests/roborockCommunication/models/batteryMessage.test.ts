import { it, expect } from 'vitest';
import * as mod from '../../../../src/roborockCommunication/models/batteryMessage.js';

it('imports batteryMessage without runtime error', () => {
  expect(mod).toBeTruthy();
});
