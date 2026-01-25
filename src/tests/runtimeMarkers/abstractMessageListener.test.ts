import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/routing/listeners/abstractMessageListener.js';

test('abstractMessageListener runtime marker present', () => {
  expect(mod).toBeDefined();
});
