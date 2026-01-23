import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/models/networkInfo.js';

test('networkInfo runtime marker present', () => {
  expect(mod).toBeDefined();
});
