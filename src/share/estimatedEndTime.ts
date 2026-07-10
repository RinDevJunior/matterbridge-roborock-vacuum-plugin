export const MIN_CLEAN_PERCENT = 5;

function computeRemainingSeconds(cleanTimeSeconds: number, cleanPercent: number | undefined): number | null {
	if (cleanPercent === undefined || cleanPercent <= 0 || cleanPercent < MIN_CLEAN_PERCENT || cleanPercent > 100) {
		return null;
	}

	if (cleanTimeSeconds <= 0) {
		return null;
	}

	if (cleanPercent === 100) {
		return 0;
	}

	return Math.round((cleanTimeSeconds * (100 - cleanPercent)) / cleanPercent);
}

export function computeEstimatedEndTimeFromCleanProgress(
	cleanTimeSeconds: number,
	cleanPercent: number | undefined,
	currentArea: number | null,
	nowEpochSeconds?: number,
): number | null {
	if (currentArea === null) {
		return null;
	}

	const remainingSeconds = computeRemainingSeconds(cleanTimeSeconds, cleanPercent);
	if (remainingSeconds === null) {
		return null;
	}

	const now = nowEpochSeconds ?? Math.floor(Date.now() / 1000);
	return now + remainingSeconds;
}

export function computeAreaEstimatedTime(cleanTimeSeconds: number, cleanPercent: number | undefined): number | null {
	return computeRemainingSeconds(cleanTimeSeconds, cleanPercent);
}
