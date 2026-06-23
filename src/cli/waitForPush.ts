import { ResponseMessage } from '../roborockCommunication/models/index.js';
import { ClientRouter } from '../roborockCommunication/routing/clientRouter.js';
import { AbstractMessageListener } from '../roborockCommunication/routing/listeners/abstractMessageListener.js';

const DEFAULT_TIMEOUT_MS = 6000;

class PushCaptureListener<T> implements AbstractMessageListener {
	readonly name = 'PushCaptureListener';
	private resolve: ((value: T) => void) | undefined;
	public readonly promise: Promise<T>;

	constructor(
		public readonly duid: string,
		private readonly parser: (message: ResponseMessage) => T | undefined,
	) {
		this.promise = new Promise((res) => {
			this.resolve = res;
		});
	}

	public async onMessage(message: ResponseMessage): Promise<void> {
		if (message.duid !== this.duid || !this.resolve) return;
		const result = this.parser(message);
		if (result !== undefined) {
			this.resolve(result);
			this.resolve = undefined;
		}
	}
}

export async function waitForPush<T>(
	clientRouter: ClientRouter,
	duid: string,
	parser: (message: ResponseMessage) => T | undefined,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T | undefined> {
	const listener = new PushCaptureListener<T>(duid, parser);
	clientRouter.registerMessageListener(listener);
	const timeout = new Promise<undefined>((res) => setTimeout(() => res(undefined), timeoutMs));
	return Promise.race([listener.promise, timeout]);
}
