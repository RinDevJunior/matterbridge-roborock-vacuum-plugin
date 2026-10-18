import { describe, expect, it } from 'vitest';

import { describeCommandSender } from '../../share/matterCommandSender.js';

const LOCAL = 'local (no remote session)';
const UNKNOWN = 'unknown sender';
const PASE = 'commissioning (PASE) session';

function createRemoteContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		fabric: 1,
		subject: { kind: 'node', id: 0xe0dceafen },
		session: {
			id: 0xc914,
			peerNodeId: 0xe0dceafen,
			fabric: { label: 'Apple Home' },
		},
		...overrides,
	};
}

function expectNoLeakedNoise(result: string): void {
	expect(result).not.toMatch(/undefined|NaN|\[object/);
}

describe('describeCommandSender', () => {
	describe('remote NodeSession context', () => {
		it('should describe fabric index, label, peer node and session id when a remote session is present', () => {
			// Arrange
			const context = createRemoteContext();

			// Act
			const result = describeCommandSender(context);

			// Assert
			expect(result).toBe('fabric 1 "Apple Home", peer node 0xe0dceafe, session 0xc914');
		});

		it('should format a numeric subject id as lowercase unpadded hex when subject.id is a number', () => {
			// Arrange
			const context = createRemoteContext({ subject: { kind: 'node', id: 0xe0dceafe } });

			// Act
			const result = describeCommandSender(context);

			// Assert
			expect(result).toContain('peer node 0xe0dceafe');
		});

		it('should format a bigint subject id as lowercase unpadded hex when subject.id is a bigint', () => {
			// Arrange
			const context = createRemoteContext({ subject: { kind: 'node', id: 0x1an } });

			// Act
			const result = describeCommandSender(context);

			// Assert
			expect(result).toContain('peer node 0x1a');
		});

		it('should fall back to session.peerNodeId when subject is missing', () => {
			// Arrange
			const context = createRemoteContext({ subject: undefined });

			// Act
			const result = describeCommandSender(context);

			// Assert
			expect(result).toBe('fabric 1 "Apple Home", peer node 0xe0dceafe, session 0xc914');
		});

		it('should omit the peer node part when both subject and session.peerNodeId are absent', () => {
			// Arrange
			const context = createRemoteContext({
				subject: undefined,
				session: { id: 0xc914, fabric: { label: 'Apple Home' } },
			});

			// Act
			const result = describeCommandSender(context);

			// Assert
			expect(result).toBe('fabric 1 "Apple Home", session 0xc914');
			expect(result).not.toContain('peer node');
		});

		it('should omit the session part when session.id is absent', () => {
			// Arrange
			const context = createRemoteContext({ session: { peerNodeId: 0xe0dceafen, fabric: { label: 'Apple Home' } } });

			// Act
			const result = describeCommandSender(context);

			// Assert
			expect(result).toBe('fabric 1 "Apple Home", peer node 0xe0dceafe');
			expect(result).not.toContain('session');
			expectNoLeakedNoise(result);
		});

		it('should omit the label part when the label is an empty string', () => {
			// Arrange
			const context = createRemoteContext({ session: { id: 0xc914, fabric: { label: '' } } });

			// Act
			const result = describeCommandSender(context);

			// Assert
			expect(result).toBe('fabric 1, peer node 0xe0dceafe, session 0xc914');
			expect(result).not.toContain('""');
		});

		it('should omit the label part when the label is not a string', () => {
			// Arrange
			const context = createRemoteContext({ session: { id: 0xc914, fabric: { label: 123 } } });

			// Act
			const result = describeCommandSender(context);

			// Assert
			expect(result).toBe('fabric 1, peer node 0xe0dceafe, session 0xc914');
			expectNoLeakedNoise(result);
		});

		it('should strip control characters from the label when the label contains them', () => {
			// Arrange
			const context = createRemoteContext({ session: { id: 0xc914, fabric: { label: 'Home\n\u0000X' } } });

			// Act
			const result = describeCommandSender(context);

			// Assert
			expect(result).toContain('fabric 1 "HomeX"');
			expect(result).not.toContain('\n');
			expect(result).not.toContain('\u0000');
		});

		it('should truncate the label to 32 characters when the label is longer than 32', () => {
			// Arrange
			const longLabel = 'A'.repeat(100);
			const context = createRemoteContext({ session: { id: 0xc914, fabric: { label: longLabel } } });

			// Act
			const result = describeCommandSender(context);

			// Assert
			expect(result).toContain(`fabric 1 "${'A'.repeat(32)}"`);
			expect(result).not.toContain('A'.repeat(33));
		});

		it('should describe only the fabric index when session is missing', () => {
			// Arrange
			const context = { fabric: 2 };

			// Act
			const result = describeCommandSender(context);

			// Assert
			// Implementation treats a missing session as "no remote session", so the fabric index is not printed.
			expect(result).toBe(LOCAL);
			expectNoLeakedNoise(result);
		});
	});

	describe('PASE sessions', () => {
		it('should describe a commissioning session without a fabric label when fabric is 0', () => {
			// Arrange
			const context = createRemoteContext({ fabric: 0 });

			// Act
			const result = describeCommandSender(context);

			// Assert
			expect(result).toBe(PASE);
			expect(result).not.toContain('Apple Home');
		});

		it('should describe a commissioning session without a fabric label when session.isPase is true', () => {
			// Arrange
			const context = createRemoteContext({ session: { id: 0xc914, isPase: true, fabric: { label: 'Apple Home' } } });

			// Act
			const result = describeCommandSender(context);

			// Assert
			expect(result).toBe(PASE);
			expect(result).not.toContain('Apple Home');
		});
	});

	describe('local and unknown actors', () => {
		it('should return the local label when the actor has no fabric or subject and is offline', () => {
			// Arrange
			const context = { fabric: undefined, subject: undefined, offline: true };

			// Act
			const result = describeCommandSender(context);

			// Assert
			expect(result).toBe(LOCAL);
		});

		it.each([
			{ name: 'undefined', input: undefined },
			{ name: 'null', input: null },
			{ name: 'a number', input: 42 },
			{ name: 'a string', input: 'x' },
			{ name: 'an empty object', input: {} },
		])('should return the local label when context is $name', ({ input }) => {
			// Arrange
			// (input supplied by it.each)

			// Act
			const result = describeCommandSender(input);

			// Assert
			expect(result).toBe(LOCAL);
		});
	});

	describe('hostile input', () => {
		it('should return the unknown label without throwing when a top-level getter throws', () => {
			// Arrange
			const context = {
				get fabric(): number {
					throw new Error('boom');
				},
			};

			// Act
			const act = (): string => describeCommandSender(context);

			// Assert
			expect(act).not.toThrow();
			expect(act()).toBe(UNKNOWN);
		});

		it('should return the unknown label without throwing when session.fabric.label getter throws', () => {
			// Arrange
			const context = {
				fabric: 1,
				session: {
					id: 0xc914,
					get fabric(): unknown {
						throw new Error('label boom');
					},
				},
			};

			// Act
			const act = (): string => describeCommandSender(context);

			// Assert
			expect(act).not.toThrow();
			expect(act()).toBe(UNKNOWN);
		});

		it('should return the unknown label without throwing when a Proxy throws on every get', () => {
			// Arrange
			const context = new Proxy(
				{},
				{
					get(): never {
						throw new Error('proxy boom');
					},
				},
			);

			// Act
			const act = (): string => describeCommandSender(context);

			// Assert
			expect(act).not.toThrow();
			expect(act()).toBe(UNKNOWN);
		});

		it('should describe the fabric without throwing when the context is circular', () => {
			// Arrange
			const session: Record<string, unknown> = { id: 0xc914 };
			const context: Record<string, unknown> = { fabric: 1, session };
			session['self'] = context;
			session['fabric'] = context;

			// Act
			const act = (): string => describeCommandSender(context);

			// Assert
			expect(act).not.toThrow();
			expectNoLeakedNoise(act());
		});
	});

	describe('secrets guard', () => {
		it('should never include key, challenge, exchange, message or subject-catalog material in the result', () => {
			// Arrange
			const context = createRemoteContext({
				exchange: { secret: 'EXCHANGE_MARKER' },
				message: { payload: 'MESSAGE_MARKER' },
				subject: { kind: 'node', id: 0xe0dceafen, catSubjects: ['CATSUBJECT_MARKER'] },
				session: {
					id: 0xc914,
					peerNodeId: 0xe0dceafen,
					keys: 'SESSION_KEYS_MARKER',
					attestationChallenge: 'ATTESTATION_MARKER',
					fabric: {
						label: 'Apple Home',
						operationalIdentityProtectionKey: 'IPK_MARKER',
					},
				},
			});

			// Act
			const result = describeCommandSender(context);

			// Assert
			expect(result).not.toContain('EXCHANGE_MARKER');
			expect(result).not.toContain('MESSAGE_MARKER');
			expect(result).not.toContain('CATSUBJECT_MARKER');
			expect(result).not.toContain('SESSION_KEYS_MARKER');
			expect(result).not.toContain('ATTESTATION_MARKER');
			expect(result).not.toContain('IPK_MARKER');
		});
	});
});
