import { expect, test } from 'vitest';
import * as mod from '../../initialData/index.js';

test('initialData index runtime marker present', () => {
  expect(mod).toBeDefined();
});
