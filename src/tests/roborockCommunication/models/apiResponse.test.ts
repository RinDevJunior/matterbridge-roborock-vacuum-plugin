import { it, expect } from 'vitest';

it('imports apiResponse without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/models/apiResponse.js');
  expect(mod).toBeTruthy();
});
