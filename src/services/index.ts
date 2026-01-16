/**
 * Services module.
 *
 * Provides specialized service classes following Single Responsibility Principle.
 * Each service handles a specific domain concern (authentication, device management, etc.).
 *
 * @example
 * ```typescript
 * import { AuthenticationService } from './services';
 *
 * const authService = new AuthenticationService(loginApi, logger);
 * const userData = await authService.loginWithVerificationCode(email, code, saveCallback);
 * ```
 */

export { AuthenticationService } from './authenticationService.js';
export type { SaveUserDataCallback, LoadUserDataCallback } from './authenticationService.js';
export { DeviceManagementService } from './deviceManagementService.js';
export { AreaManagementService } from './areaManagementService.js';
export { MessageRoutingService } from './messageRoutingService.js';
export { PollingService } from './pollingService.js';
export { default as ClientManager } from './clientManager.js';
export { ServiceContainer } from './serviceContainer.js';
export type { ServiceContainerConfig } from './serviceContainer.js';
export { ConnectionService } from './connectionService.js';
