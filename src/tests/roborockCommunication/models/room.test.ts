import { it, expect } from 'vitest';

it('imports room without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/models/room.js');
  expect(mod).toBeTruthy();
});
