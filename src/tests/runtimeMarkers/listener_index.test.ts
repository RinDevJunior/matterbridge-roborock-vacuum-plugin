import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/broadcast/listener/index.js';

test('broadcast listener index runtime marker present', () => {
  expect(mod).toBeDefined();
});
