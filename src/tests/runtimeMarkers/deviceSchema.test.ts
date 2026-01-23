import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/models/deviceSchema.js';

test('deviceSchema runtime marker present', () => {
  expect(mod).toBeDefined();
});
