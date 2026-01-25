import { expect, test } from 'vitest';
import * as mod from '../../types/config.js';

test('types config runtime marker present', () => {
  expect(mod).toBeDefined();
});
