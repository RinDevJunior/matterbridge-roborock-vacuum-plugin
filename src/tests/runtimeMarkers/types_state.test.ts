import { expect, test } from 'vitest';
import * as mod from '../../types/state.js';

test('types state runtime marker present', () => {
  expect(mod).toBeDefined();
});
