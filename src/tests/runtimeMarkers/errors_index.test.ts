import { expect, test } from 'vitest';
import * as mod from '../../errors/index.js';

test('errors index runtime marker present', () => {
  expect(mod).toBeDefined();
});
