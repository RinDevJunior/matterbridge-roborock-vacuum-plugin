import { it, expect } from 'vitest';
import * as mod from '../../../../src/roborockCommunication/models/scene.js';

it('imports scene without runtime error', () => {
  expect(mod).toBeTruthy();
});
