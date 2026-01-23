import { it, expect } from 'vitest';

it('imports device without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/Zmodel/device.js');
  expect(mod).toBeTruthy();
});
