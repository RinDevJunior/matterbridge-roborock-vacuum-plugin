import { it, expect } from 'vitest';
import * as mod from '../../../../src/roborockCommunication/models/product.js';

it('imports product without runtime error', () => {
  expect(mod).toBeTruthy();
});
