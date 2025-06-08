import { CloudMessageResult } from '../roborockCommunication/Zmodel/messageResult.js';

export interface CloudMessageModel {
  duid: string;
  dps: Record<
    string,
    | number
    | {
        id: number;
        result: CloudMessageResult[];
      }
  >;
}
