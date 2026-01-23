import { it, expect } from 'vitest';

it('imports product without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/models/product.js');
  expect(mod).toBeTruthy();
});
