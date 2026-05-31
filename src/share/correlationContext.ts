import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';

const storage = new AsyncLocalStorage<string>();

export function runWithCorrelation<T>(id: string, fn: () => T): T {
	return storage.run(id, fn);
}

export function getCorrelationId(): string | undefined {
	return storage.getStore();
}

export function generateCorrelationId(prefix: string): string {
	return `${prefix}:${randomBytes(4).toString('hex')}`;
}
