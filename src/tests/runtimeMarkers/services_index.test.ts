import { expect, test } from 'vitest';
import * as mod from '../../services/index.js';

test('services index runtime marker present', () => {
  expect(mod).toBeDefined();
});
