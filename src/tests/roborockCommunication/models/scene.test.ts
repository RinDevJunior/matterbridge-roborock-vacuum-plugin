import { it, expect } from 'vitest';

it('imports scene without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/models/scene.js');
  expect(mod).toBeTruthy();
});
