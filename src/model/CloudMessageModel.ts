import { Dps } from '../roborockCommunication/models/index.js';

export interface CloudMessageModel {
  duid: string;
  dps: Dps;
}
