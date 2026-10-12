import type { MatterbridgeDynamicPlatform } from 'matterbridge';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getWssSendSnackbarMessage } from '../../types/WssSendSnackbarMessage.js';
import { asPartial, createMockLogger, createMockMatterbridge } from '../helpers/testUtils.js';

describe('getWssSendSnackbarMessage (gaps)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should fall back to platform.log.notice when the platform has no wssSendSnackbarMessage', () => {
		// Arrange
		const platform = asPartial<MatterbridgeDynamicPlatform>({
			log: mockLogger,
			matterbridge: createMockMatterbridge(),
		});
		// Act
		const send = getWssSendSnackbarMessage(platform);
		send('Cleaning started', 1000, 'info');
		// Assert
		expect(mockLogger.notice).toHaveBeenCalledWith('Cleaning started');
	});

	it('should bind the platform wssSendSnackbarMessage to the platform when it is provided', () => {
		// Arrange
		const boundThis: unknown[] = [];
		const wssSend = vi.fn(function (this: unknown) {
			boundThis.push(this);
		});
		const platform = Object.assign(
			asPartial<MatterbridgeDynamicPlatform>({
				log: mockLogger,
				matterbridge: createMockMatterbridge(),
			}),
			{ wssSendSnackbarMessage: wssSend },
		);
		// Act
		const send = getWssSendSnackbarMessage(platform);
		send('hello', 500, 'success');
		// Assert
		expect(wssSend).toHaveBeenCalledWith('hello', 500, 'success');
		expect(boundThis[0]).toBe(platform);
		expect(mockLogger.notice).not.toHaveBeenCalled();
	});

	it('should bind the frontend wssSendSnackbarMessage to the frontend when the platform has none', () => {
		// Arrange
		const boundThis: unknown[] = [];
		const frontend = {
			wssSendSnackbarMessage: vi.fn(function (this: unknown) {
				boundThis.push(this);
			}),
		};
		const platform = asPartial<MatterbridgeDynamicPlatform>({
			log: mockLogger,
			matterbridge: Object.assign(createMockMatterbridge(), { frontend }),
		});
		// Act
		const send = getWssSendSnackbarMessage(platform);
		send('from frontend');
		// Assert
		expect(frontend.wssSendSnackbarMessage).toHaveBeenCalledWith('from frontend');
		expect(boundThis[0]).toBe(frontend);
		expect(mockLogger.notice).not.toHaveBeenCalled();
	});
});
