import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/serializer/Serializer.js';

test('Serializer runtime marker present', () => {
  expect(mod).toBeDefined();
});
