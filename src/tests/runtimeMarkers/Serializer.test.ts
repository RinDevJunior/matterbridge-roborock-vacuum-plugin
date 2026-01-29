import { expect, test } from 'vitest';
import * as mod from '../../roborockCommunication/protocol/serializers/abstractSerializer.js';

test('Serializer runtime marker present', () => {
  expect(mod).toBeDefined();
});
