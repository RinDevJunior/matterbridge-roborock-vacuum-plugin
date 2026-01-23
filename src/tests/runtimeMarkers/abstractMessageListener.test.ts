import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/broadcast/listener/abstractMessageListener.js';

test('abstractMessageListener runtime marker present', () => {
  expect(mod).toBeDefined();
});
