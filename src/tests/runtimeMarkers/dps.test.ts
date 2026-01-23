import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/models/dps.js';

test('dps runtime marker present', () => {
  expect(mod).toBeDefined();
});
