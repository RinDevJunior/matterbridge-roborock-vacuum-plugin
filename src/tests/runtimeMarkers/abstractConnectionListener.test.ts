import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/routing/listeners/abstractConnectionListener.js';

test('abstractConnectionListener runtime marker present', () => {
  expect(mod).toBeDefined();
});
