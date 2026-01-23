import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/models/product.js';

test('product runtime marker present', () => {
  expect(mod).toBeDefined();
});
