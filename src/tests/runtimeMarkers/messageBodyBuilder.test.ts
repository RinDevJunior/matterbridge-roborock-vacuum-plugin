import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/protocol/builders/abstractMessageBodyBuilder.js';

test('messageBodyBuilder runtime marker present', () => {
  expect(mod).toBeDefined();
});
