import { it, expect } from 'vitest';
import * as mod from '../../../../src/roborockCommunication/models/deviceSchema.js';

it('imports deviceSchema without runtime error', () => {
  expect(mod).toBeTruthy();
});
