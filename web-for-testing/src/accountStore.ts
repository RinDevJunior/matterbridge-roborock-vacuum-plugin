import { UserData } from './ext/roborockCommunication/index.js';

export function getAccountStore(): Map<string, UserData> {
  const accountStore = new Map<string, UserData>();

  // Initialize with a default user data if needed
  // accountStore.set('defaultUser', new UserData());

  return accountStore;
}
