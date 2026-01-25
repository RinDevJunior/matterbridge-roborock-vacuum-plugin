import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/protocol/serializers/Serializer.js';

test('Serializer runtime marker present', () => {
  expect(mod).toBeDefined();
});
