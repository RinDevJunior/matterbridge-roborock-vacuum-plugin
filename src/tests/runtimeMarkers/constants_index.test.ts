import { expect, test } from 'vitest';
import * as mod from '../../constants/index.js';

test('constants index runtime marker present', () => {
  expect(mod).toBeDefined();
});
