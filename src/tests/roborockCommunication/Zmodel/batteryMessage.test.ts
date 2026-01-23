import { it, expect } from 'vitest';

it('imports batteryMessage without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/Zmodel/batteryMessage.js');
  expect(mod).toBeTruthy();
});
