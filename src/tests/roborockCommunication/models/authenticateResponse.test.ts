import { it, expect } from 'vitest';

it('imports authenticateResponse without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/models/authenticateResponse.js');
  expect(mod).toBeTruthy();
});
