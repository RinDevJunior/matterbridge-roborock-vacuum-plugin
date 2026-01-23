import { it, expect } from 'vitest';

it('imports userData without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/Zmodel/userData.js');
  expect(mod).toBeTruthy();
});
