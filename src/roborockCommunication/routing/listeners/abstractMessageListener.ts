import { ResponseMessage } from '../../models/responseMessage.js';

export interface AbstractMessageListener {
	name: string;
	duid: string;
	requiresBody: boolean;
	onMessage(message: ResponseMessage): Promise<void>;
}
