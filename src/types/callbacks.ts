import { UserData } from '../roborockCommunication/models/index.js';

/**
 * Callback function to save user data after successful authentication.
 * Used during login flows to persist authentication tokens.
 */
export type SaveUserDataCallback = (userData: UserData) => Promise<void>;

/**
 * Callback function to load previously saved user data.
 * Used during authentication to retrieve cached tokens.
 */
export type LoadUserDataCallback = () => Promise<UserData | undefined>;
