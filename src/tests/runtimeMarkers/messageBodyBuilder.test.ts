import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/builder/messageBodyBuilder.js';

test('messageBodyBuilder runtime marker present', () => {
  expect(mod).toBeDefined();
});
