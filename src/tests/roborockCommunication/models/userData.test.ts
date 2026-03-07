import { expect, it } from 'vitest';

import * as mod from '../../../../src/roborockCommunication/models/userData.js';

it('imports userData without runtime error', () => {
	expect(mod).toBeTruthy();
});
