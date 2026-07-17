import { MESSAGE_TIMEOUT_MS } from '../../../constants/index.js';
import { ResponseMessage } from '../../models/responseMessage.js';
import { AbstractMessageListener } from './abstractMessageListener.js';

export class OneShotResponseListener<T> implements AbstractMessageListener {
	readonly name = 'OneShotResponseListener';
	readonly requiresBody = false;

	private resolve?: (value: T) => void;
	private reject?: (error: Error) => void;
	private timer?: NodeJS.Timeout;
	private settled = false;

	constructor(
		public readonly duid: string,
		private readonly parseFn: (msg: ResponseMessage) => T | undefined,
		private readonly timeoutMs: number = MESSAGE_TIMEOUT_MS,
	) {}

	public waitFor(): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
			this.timer = setTimeout(() => {
				if (!this.settled) {
					this.settled = true;
					reject(new Error(`[OneShotResponseListener] Timeout after ${this.timeoutMs}ms for duid: ${this.duid}`));
				}
			}, this.timeoutMs);
		});
	}

	public async onMessage(message: ResponseMessage): Promise<void> {
		if (this.settled) return;
		if (message.duid !== this.duid) return;

		const result = this.parseFn(message);
		if (result === undefined) return;

		this.settled = true;
		if (this.timer) {
			clearTimeout(this.timer);
		}
		this.resolve?.(result);
	}
}
