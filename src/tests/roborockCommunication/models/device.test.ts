import { it, expect } from 'vitest';

it('imports device without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/models/device.js');
  expect(mod).toBeTruthy();
});
