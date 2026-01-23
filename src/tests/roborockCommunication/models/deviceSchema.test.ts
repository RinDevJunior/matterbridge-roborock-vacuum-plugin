import { it, expect } from 'vitest';

it('imports deviceSchema without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/models/deviceSchema.js');
  expect(mod).toBeTruthy();
});
