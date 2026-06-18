# Authentication Flow

```mermaid
flowchart TD
    Start([authenticate method, context]) --> Coordinator{AuthenticationCoordinator}
    Coordinator -->|method=Password| PwdStrat[PasswordAuthStrategy]
    Coordinator -->|method=VerificationCode| TfaStrat[TwoFactorAuthStrategy]

    %% Shared cached-token path
    PwdStrat --> CachedCheck{alwaysExecuteAuthentication?}
    TfaStrat --> CachedCheck
    CachedCheck -->|true| ClearCache[clearUserData] --> NoCached[No cached UserData]
    CachedCheck -->|false| LoadCache[UserDataRepository.loadUserData username]
    LoadCache -->|none found / region mismatch| NoCached
    LoadCache -->|found| TryCached[authService.loginWithCachedToken]
    TryCached -->|success| Done([Return UserData ✅])
    TryCached -->|fails| ClearCache2[clearUserData] --> NoCached

    %% Password branch
    NoCached --> WhichStrat{which strategy?}
    WhichStrat -->|Password| PwdLogin[authService.loginWithPassword username,password]
    PwdLogin -->|success| SaveUD1[UserDataRepository.saveUserData] --> Done
    PwdLogin -->|error| AuthErr1([Throw mapped error:\nInvalidCredentialsError / AuthenticationError])

    %% 2FA branch
    WhichStrat -->|VerificationCode| HasCode{context.verificationCode\nprovided?}

    HasCode -->|no| RateCheck{VerificationCodeService\n.isRateLimited?}
    RateCheck -->|yes| WaitBanner[Log + toast:\n'wait Ns before requesting again'] --> ReturnUndef1([Return undefined\n— wait for user input])
    RateCheck -->|no| ReqCode[authGateway.requestVerificationCode\nvia api/v4/email/code/send]
    ReqCode --> RecordReq[VerificationCodeService.recordCodeRequest]
    RecordReq --> Banner[Log + toast:\n'Enter the 6-digit code\nin verificationCode field']
    Banner --> ReturnUndef2([Return undefined\n— wait for user input])
    ReqCode -->|error| AuthErr2([Throw error])

    HasCode -->|yes| CodeLogin[authService.loginWithVerificationCode\nusername, code\n→ api/v4/auth/email/login/code]
    CodeLogin -->|success| SaveUD2[saveUserData] --> ClearCodeState[VerificationCodeService\n.clearCodeRequestState] --> Done
    CodeLogin -->|error| AuthErr3([Throw mapped error:\nVerificationCodeExpiredError /\nTokenExpiredError / AuthenticationError])

    classDef err fill:#fdd,stroke:#c00;
    class AuthErr1,AuthErr2,AuthErr3 err;
    classDef pending fill:#ffd,stroke:#cc8400;
    class ReturnUndef1,ReturnUndef2 pending;
    classDef ok fill:#dfd,stroke:#0a0;
    class Done ok;
```

## Key points

- `AuthenticationCoordinator` is just a dispatcher — picks `PasswordAuthStrategy` or `TwoFactorAuthStrategy` from a `Map<'Password'|'VerificationCode', IAuthStrategy>`.
- Both strategies extend `BaseAuthStrategy`, which always tries `tryAuthenticateWithCachedToken()` first (unless `alwaysExecuteAuthentication` config is set), via `UserDataRepository` (validates username+region) → `AuthenticationService.loginWithCachedToken` → `RoborockAuthGateway.refreshToken`.
- **Password path**: cache miss → `loginWithPassword` (`api/v1/login`) → save token.
- **2FA path**: cache miss → if no code yet, request one (rate-limited via `VerificationCodeService`, 15-min window) and return `undefined` so the user supplies the code via config; if code is present, `loginWithVerificationCode` (`api/v4/auth/email/login/code`) → save token + clear code-request state.
- All terminal calls funnel through `AuthenticationService`, which wraps `RoborockAuthGateway` → `RoborockAuthenticateApi`, mapping errors to `InvalidCredentialsError`, `TokenExpiredError`, `VerificationCodeExpiredError`, or generic `AuthenticationError`.
