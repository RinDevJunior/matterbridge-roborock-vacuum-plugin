import { AnsiLogger } from 'matterbridge/logger';
import { AuthenticationError } from '../../errors/index.js';
import { VERIFICATION_CODE_RATE_LIMIT_MS } from '../../constants/index.js';
import { AuthenticationStateRepository } from './AuthenticationStateRepository.js';
import type { AuthenticateFlowState } from '../../roborockCommunication/models/index.js';
import { RoborockAuthGateway } from '../../roborockCommunication/adapters/RoborockAuthGateway.js';

/** Service for managing verification code requests and rate limiting. */
export class VerificationCodeService {
  constructor(
    private readonly authGateway: RoborockAuthGateway,
    private readonly stateRepository: AuthenticationStateRepository,
    private readonly logger: AnsiLogger,
  ) {}

  /** Request verification code to be sent to email. */
  public async requestVerificationCode(email: string): Promise<void> {
    try {
      this.logger.debug('Requesting verification code for email:', email);
      await this.authGateway.requestVerificationCode(email);
    } catch (error) {
      this.logger.error('Failed to request verification code:', { email, error });
      throw new AuthenticationError(
        'Failed to send verification code. Please check your email address and try again.',
        {
          email,
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  /** Check if rate limit is active for verification code requests. */
  public async isRateLimited(): Promise<boolean> {
    const authState = await this.stateRepository.getAuthState();
    if (!authState?.codeRequestedAt) {
      return false;
    }

    const now = Date.now();
    return now - authState.codeRequestedAt < VERIFICATION_CODE_RATE_LIMIT_MS;
  }

  /** Get remaining wait time in seconds before next code request. */
  public async getRemainingWaitTime(): Promise<number> {
    const authState = await this.stateRepository.getAuthState();
    if (!authState?.codeRequestedAt) {
      return 0;
    }

    const now = Date.now();
    const elapsed = now - authState.codeRequestedAt;
    if (elapsed >= VERIFICATION_CODE_RATE_LIMIT_MS) {
      return 0;
    }

    return Math.ceil((VERIFICATION_CODE_RATE_LIMIT_MS - elapsed) / 1000);
  }

  /** Record that a verification code was requested. */
  public async recordCodeRequest(email: string): Promise<void> {
    await this.stateRepository.saveAuthState({
      email,
      codeRequestedAt: Date.now(),
    } satisfies AuthenticateFlowState);
  }

  /** Clear verification code request state. */
  public async clearCodeRequestState(): Promise<void> {
    await this.stateRepository.clearAuthState();
  }
}
