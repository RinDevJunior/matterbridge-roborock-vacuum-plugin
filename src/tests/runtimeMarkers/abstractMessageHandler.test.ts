import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/broadcast/listener/abstractMessageHandler.js';

test('abstractMessageHandler runtime marker present', () => {
  expect(mod).toBeDefined();
});
