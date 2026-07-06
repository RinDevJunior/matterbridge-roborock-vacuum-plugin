export const MIN_CLEAN_PERCENT = 5;

export function computeEstimatedEndTimeFromCleanProgress(
	cleanTimeSeconds: number,
	cleanPercent: number | undefined,
	currentArea: number | null,
	nowEpochSeconds?: number,
): number | null {
	if (currentArea === null) {
		return null;
	}

	if (cleanPercent === undefined || cleanPercent <= 0 || cleanPercent < MIN_CLEAN_PERCENT || cleanPercent > 100) {
		return null;
	}

	if (cleanTimeSeconds <= 0) {
		return null;
	}

	const now = nowEpochSeconds ?? Math.floor(Date.now() / 1000);

	if (cleanPercent === 100) {
		return now;
	}

	const remainingSeconds = Math.round((cleanTimeSeconds * (100 - cleanPercent)) / cleanPercent);

	return now + remainingSeconds;
}
