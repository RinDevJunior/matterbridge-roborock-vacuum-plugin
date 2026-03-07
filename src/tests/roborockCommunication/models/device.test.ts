import { expect, it } from 'vitest';

import * as mod from '../../../../src/roborockCommunication/models/device.js';

it('imports device without runtime error', () => {
	expect(mod).toBeTruthy();
});
