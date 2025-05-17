import { CloudMessageResult } from '../roborockCommunication/Zmodel/messageResult.js';

export interface CloudMessageModel {
  duid: string;
  dps: {
    [key: string]:
      | number
      | {
          id: number;
          result: CloudMessageResult[];
        };
  };
}
