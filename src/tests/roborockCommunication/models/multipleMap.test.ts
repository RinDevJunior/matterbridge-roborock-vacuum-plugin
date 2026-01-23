import { it, expect } from 'vitest';

it('imports multipleMap without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/models/multipleMap.js');
  expect(mod).toBeTruthy();
});
