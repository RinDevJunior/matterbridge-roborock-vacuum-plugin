import { it, expect } from 'vitest';

it('imports baseURL without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/Zmodel/baseURL.js');
  expect(mod).toBeTruthy();
});
