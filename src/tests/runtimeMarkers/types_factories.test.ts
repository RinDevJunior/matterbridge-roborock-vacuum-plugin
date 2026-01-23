import { expect, test } from 'vitest';
import * as mod from '../../types/factories.js';

test('types factories runtime marker present', () => {
  expect(mod).toBeDefined();
});
