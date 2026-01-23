import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/routing/handlers/abstractMessageHandler.js';

test('abstractMessageHandler runtime marker present', () => {
  expect(mod).toBeDefined();
});
