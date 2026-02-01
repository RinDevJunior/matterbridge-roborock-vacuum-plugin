import { it, expect } from 'vitest';
import * as mod from '../../../../src/roborockCommunication/models/apiResponse.js';

it('imports apiResponse without runtime error', () => {
  expect(mod).toBeTruthy();
});
