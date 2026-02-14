import { UserData } from '../roborockCommunication/models/userData.js';

export interface AuthenticationResponse {
  userData: UserData | undefined;
  shouldContinue: boolean;
  isSuccess: boolean;
}
