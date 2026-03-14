import readline from 'node:readline';

export function parseArgs(args: string[]): Record<string, string> {
	const result: Record<string, string> = {};
	for (let i = 0; i < args.length; i++) {
		if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
			result[args[i].slice(2)] = args[i + 1];
			i++;
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
