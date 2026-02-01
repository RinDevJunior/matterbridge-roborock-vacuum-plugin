import { it, expect } from 'vitest';
import * as mod from '../../../../src/roborockCommunication/models/networkInfo.js';

it('imports networkInfo without runtime error', () => {
  expect(mod).toBeTruthy();
});
