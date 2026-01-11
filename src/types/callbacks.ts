/**
 * Callback function type definitions.
 * @module types/callbacks
 */

import type { UserData } from '../roborockCommunication/index.js';

/**
 * Callback function to save user data after successful authentication.
 * Used during login flows to persist authentication tokens.
 *
 * @param userData - The user data containing authentication tokens
 * @returns Promise that resolves when data is saved
 *
 * @example
 * ```typescript
 * const saveUserData: SaveUserDataCallback = async (userData) => {
 *   await fs.writeFile('user-data.json', JSON.stringify(userData));
 * };
 * ```
 */
export type SaveUserDataCallback = (userData: UserData) => Promise<void>;

/**
 * Callback function to load previously saved user data.
 * Used during authentication to retrieve cached tokens.
 *
 * @returns Promise that resolves with user data if available, undefined otherwise
 *
 * @example
 * ```typescript
 * const loadUserData: LoadUserDataCallback = async () => {
 *   try {
 *     const data = await fs.readFile('user-data.json', 'utf-8');
 *     return JSON.parse(data) as UserData;
 *   } catch {
 *     return undefined;
 *   }
 * };
 * ```
 */
export type LoadUserDataCallback = () => Promise<UserData | undefined>;
