import { expect, test } from 'vitest';
import * as mod from '../../types/MessagePayloads.js';

test('MessagePayloads runtime marker present', () => {
  expect(mod).toBeDefined();
});
