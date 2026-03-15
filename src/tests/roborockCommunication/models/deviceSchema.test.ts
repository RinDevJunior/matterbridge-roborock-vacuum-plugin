import { expect, it } from 'vitest';

import * as mod from '../../../../src/roborockCommunication/models/deviceSchema.js';

it('imports deviceSchema without runtime error', () => {
	expect(mod).toBeTruthy();
});
