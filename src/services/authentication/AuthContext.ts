/** Context object passed to authentication strategies. */
export interface AuthContext {
  readonly username: string;
  readonly password: string;
  readonly verificationCode?: string;
}
