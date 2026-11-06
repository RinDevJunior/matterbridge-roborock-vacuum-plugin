import { ResourceMonitoring } from 'matterbridge/matter/clusters';

export const FILTER_RATED_LIFE_SEC = 540000;

export interface ConsumableStatus {
	filterWorkTimeSec?: number;
	filterConditionPercent?: number;
}

export function computeFilterConditionPercent(filterWorkTimeSec: number): number {
	const percent = ((FILTER_RATED_LIFE_SEC - filterWorkTimeSec) / FILTER_RATED_LIFE_SEC) * 100;
	return Math.max(0, Math.min(100, Math.round(percent)));
}

export function resolveFilterConditionPercent(
	status: Pick<ConsumableStatus, 'filterWorkTimeSec' | 'filterConditionPercent'>,
): number {
	if (status.filterConditionPercent !== undefined) {
		return Math.max(0, Math.min(100, Math.round(status.filterConditionPercent)));
	}
	return computeFilterConditionPercent(status.filterWorkTimeSec ?? 0);
}

export function computeFilterChangeIndication(conditionPercent: number): ResourceMonitoring.ChangeIndication {
	if (conditionPercent <= 5) return ResourceMonitoring.ChangeIndication.Critical;
	if (conditionPercent <= 15) return ResourceMonitoring.ChangeIndication.Warning;
	return ResourceMonitoring.ChangeIndication.Ok;
}
