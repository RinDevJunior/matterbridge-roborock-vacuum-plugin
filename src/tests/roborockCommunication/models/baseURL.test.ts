import { it, expect } from 'vitest';
import * as mod from '../../../../src/roborockCommunication/models/baseURL.js';

it('imports baseURL without runtime error', () => {
  expect(mod).toBeTruthy();
});
