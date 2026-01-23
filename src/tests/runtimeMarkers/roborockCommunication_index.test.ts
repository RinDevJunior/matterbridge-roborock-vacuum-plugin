import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/index.js';

test('roborockCommunication index runtime marker present', () => {
  expect(mod).toBeDefined();
});
