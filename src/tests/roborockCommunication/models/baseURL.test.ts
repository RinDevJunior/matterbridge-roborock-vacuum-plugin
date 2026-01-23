import { it, expect } from 'vitest';

it('imports baseURL without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/models/baseURL.js');
  expect(mod).toBeTruthy();
});
