import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/models/homeInfo.js';

test('homeInfo runtime marker present', () => {
  expect(mod).toBeDefined();
});
