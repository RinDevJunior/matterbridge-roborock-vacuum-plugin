import { it, expect } from 'vitest';

it('imports map without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/Zmodel/map.js');
  expect(mod).toBeTruthy();
});
