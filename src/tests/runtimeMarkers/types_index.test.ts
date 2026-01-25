import { expect, test } from 'vitest';
import * as mod from '../../types/index.js';

test('types index runtime marker present', () => {
  expect(mod).toBeDefined();
});
