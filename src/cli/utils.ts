import readline from 'node:readline';

export function parseArgs(args: string[]): Record<string, string> {
	const result: Record<string, string> = {};
	for (let i = 0; i < args.length; i++) {
		const key = args[i];
		if (!key.startsWith('--')) continue;
		const name = key.slice(2);
		const next = args[i + 1];
		if (next !== undefined && !next.startsWith('--')) {
			result[name] = next;
			i++;
		} else {
			result[name] = 'true';
		}
	}
	return result;
}

export async function prompt(question: string): Promise<string> {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}
