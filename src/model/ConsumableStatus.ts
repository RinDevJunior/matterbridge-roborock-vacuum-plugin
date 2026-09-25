import { ResourceMonitoring } from 'matterbridge/matter/clusters';

export const FILTER_RATED_LIFE_SEC = 540000;

export interface ConsumableStatus {
	filterWorkTimeSec: number;
}

export function computeFilterConditionPercent(filterWorkTimeSec: number): number {
	const percent = ((FILTER_RATED_LIFE_SEC - filterWorkTimeSec) / FILTER_RATED_LIFE_SEC) * 100;
	return Math.max(0, Math.min(100, Math.round(percent)));
}

export function computeFilterChangeIndication(conditionPercent: number): ResourceMonitoring.ChangeIndication {
	if (conditionPercent <= 5) return ResourceMonitoring.ChangeIndication.Critical;
	if (conditionPercent <= 15) return ResourceMonitoring.ChangeIndication.Warning;
	return ResourceMonitoring.ChangeIndication.Ok;
}
