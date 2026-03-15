import { Device, UserData } from '../roborockCommunication/models/index.js';

export interface CliSession {
	email: string;
	userData: UserData;
	devices: Device[];
}

export const SESSION_FILE = '.cli-session.json';
export const DEFAULT_BASE_URL = 'https://usiot.roborock.com';
export const CONNECT_TIMEOUT_MS = 10_000;
export const CONNECT_POLL_MS = 200;
