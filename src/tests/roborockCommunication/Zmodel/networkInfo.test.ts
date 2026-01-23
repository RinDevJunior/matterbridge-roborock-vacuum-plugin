import { it, expect } from 'vitest';

it('imports networkInfo without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/Zmodel/networkInfo.js');
  expect(mod).toBeTruthy();
});
