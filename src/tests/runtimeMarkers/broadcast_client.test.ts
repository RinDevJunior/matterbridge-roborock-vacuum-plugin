import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/broadcast/client.js';

test('broadcast client runtime marker present', () => {
  expect(mod).toBeDefined();
});
