import { CloudMessageResult } from '../roborockCommunication/Zmodel/messageResult.js';

interface CloudMessageDpsEntry {
  id: number;
  result: CloudMessageResult[];
}

export interface CloudMessageModel {
  duid: string;
  dps: Record<string, number | CloudMessageDpsEntry>;
}
