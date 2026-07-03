import type { LegacyNamedRoom } from '../roborockCommunication/map/legacy/mapParser.js';
import { Protocol, ResponseMessage } from '../roborockCommunication/models/index.js';

function unwrapRpcResult(msg: ResponseMessage): unknown {
	const dps = (msg.get(Protocol.rpc_response) ?? msg.get(Protocol.general_response)) as
		| { result?: unknown }
		| undefined;
	if (!dps?.result) return undefined;
	return Array.isArray(dps.result) ? dps.result[0] : dps.result;
}

/** map_status >> 2; returns undefined when missing or sentinel 63 (unknown). */
export function resolveActiveMapId(status: unknown): number | undefined {
	if (!status || typeof status !== 'object' || !('map_status' in status)) return undefined;
	const mapStatus = status.map_status;
	if (typeof mapStatus !== 'number') return undefined;
	const mapFlag = mapStatus >> 2;
	return mapFlag !== 63 ? mapFlag : undefined;
}

/** Push parser: RPC result object containing map_info[]. */
export function parseMapInfoPush(msg: ResponseMessage): unknown {
	const raw = unwrapRpcResult(msg);
	if (raw && typeof raw === 'object' && 'map_info' in raw) return raw;
	return undefined;
}

/** Push parser: RPC result object containing map_status. */
export function parseDeviceStatusPush(msg: ResponseMessage): unknown {
	const raw = unwrapRpcResult(msg);
	if (raw && typeof raw === 'object' && 'map_status' in raw) return raw;
	return undefined;
}

/** Build LegacyNamedRoom[] from get_multi_maps_list push, scoped to active map. */
export function extractNamedRooms(mapResult: unknown, activeMapId: number | undefined): LegacyNamedRoom[] {
	if (activeMapId === undefined) return [];
	if (!mapResult || typeof mapResult !== 'object' || !('map_info' in mapResult)) return [];

	const rawMapInfo = mapResult.map_info;
	if (!Array.isArray(rawMapInfo)) return [];

	const activeMap = rawMapInfo.find(
		(m) => !!m && typeof m === 'object' && 'mapFlag' in m && m.mapFlag === activeMapId,
	) as { rooms?: { id: number; iot_name?: string }[] } | undefined;
	if (!activeMap?.rooms) return [];

	return activeMap.rooms.map((room) => ({
		id: room.id,
		name: room.iot_name?.trim() ?? '',
	}));
}

/** Lookup display name; returns '' when not found (caller prints '(unnamed)'). */
export function roomDisplayName(segmentId: number, namedRooms: LegacyNamedRoom[]): string {
	const room = namedRooms.find((r) => r.id === segmentId);
	return room?.name ?? '';
}
