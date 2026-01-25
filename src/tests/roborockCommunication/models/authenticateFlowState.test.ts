import { it, expect } from 'vitest';

it('imports authenticateFlowState without runtime error', async () => {
  const mod = await import('../../../../src/roborockCommunication/models/authenticateFlowState.js');
  expect(mod).toBeTruthy();
});
