import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/broadcast/listener/abstractConnectionListener.js';

test('abstractConnectionListener runtime marker present', () => {
  expect(mod).toBeDefined();
});
