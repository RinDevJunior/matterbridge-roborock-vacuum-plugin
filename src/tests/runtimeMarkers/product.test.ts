import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/Zmodel/product.js';

test('product runtime marker present', () => {
  expect(mod).toBeDefined();
});
