import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthenticationStateRepository } from '../../../services/authentication/AuthenticationStateRepository.js';
import { createMockLocalStorage, asPartial } from '../../helpers/testUtils.js';
import type { AuthenticateFlowState } from '../../../roborockCommunication/models/index.js';

describe('AuthenticationStateRepository', () => {
	let persist: ReturnType<typeof createMockLocalStorage>;
	let repo: AuthenticationStateRepository;

	beforeEach(() => {
		vi.clearAllMocks();
		persist = createMockLocalStorage();
		repo = new AuthenticationStateRepository(persist);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('getAuthState', () => {
		it('should return the stored auth state', async () => {
			const state = asPartial<AuthenticateFlowState>({ email: 'user@example.com' });
			vi.mocked(persist.getItem).mockResolvedValue(state);

			const result = await repo.getAuthState();

			expect(persist.getItem).toHaveBeenCalledWith('authenticateFlowState');
			expect(result).toBe(state);
		});

		it('should return undefined when no state is stored', async () => {
			vi.mocked(persist.getItem).mockResolvedValue(undefined);

			const result = await repo.getAuthState();

			expect(result).toBeUndefined();
		});
	});

	describe('saveAuthState', () => {
		it('should persist the auth state with correct key', async () => {
			const state = asPartial<AuthenticateFlowState>({ email: 'user@example.com' });

			await repo.saveAuthState(state);

			expect(persist.setItem).toHaveBeenCalledWith('authenticateFlowState', state);
		});
	});

	describe('clearAuthState', () => {
		it('should remove the persisted auth state', async () => {
			await repo.clearAuthState();

			expect(persist.removeItem).toHaveBeenCalledWith('authenticateFlowState');
		});
	});
});
