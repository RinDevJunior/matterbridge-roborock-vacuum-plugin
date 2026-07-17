/** Maps rr_* firmware tokens to English display names. */
export const RR_ROOM_TYPE_TOKENS: Record<string, string> = {
	rr_other: 'Room',
	rr_master_room: 'Master bedroom',
	rr_guest_bedroom: 'Guest bedroom',
	rr_bedroom: 'Bedroom',
	rr_living_room: 'Living room',
	rr_restaurant: 'Dining room',
	rr_kitchen: 'Kitchen',
	rr_balcony: 'Balcony',
	rr_toilet: 'Bathroom',
	rr_entrance_hall: 'Entrance hall',
	rr_study: 'Study',
	rr_corridor: 'Corridor',
};

/** Maps roomTypeId 0–11 to the corresponding rr_* token. Mirrors ioBroker ROOM_TYPE_ID_TO_TOKEN. */
const ROOM_TYPE_ID_TO_TOKEN: Record<number, string> = {
	0: 'rr_other',
	1: 'rr_master_room',
	2: 'rr_guest_bedroom',
	3: 'rr_bedroom',
	4: 'rr_living_room',
	5: 'rr_restaurant',
	6: 'rr_kitchen',
	7: 'rr_balcony',
	8: 'rr_toilet',
	9: 'rr_entrance_hall',
	10: 'rr_study',
	11: 'rr_corridor',
};

/**
 * Normalizes a B01 protobuf roomName to a human-readable display label.
 *
 * Rules (in order):
 * 1. Empty / whitespace → use roomTypeId lookup (if known and not rr_other) → `Room ${roomId}` default.
 * 2. Known rr_* token (excl. rr_other) → English label.
 * 3. rr_other → `Room ${roomId}` (or "Room" if roomId unavailable).
 * 4. /^room(\d{1,2})$/i pattern → `Room${N}` (e.g. room5 → Room5).
 * 5. All other values → pass through unchanged.
 */
export function normalizeB01RoomName(roomName: string | undefined, roomTypeId?: number, roomId?: number): string {
	const defaultName = roomId !== undefined ? `Room ${roomId}` : 'Room';
	const trimmed = roomName?.trim() ?? '';

	if (!trimmed) {
		if (roomTypeId !== undefined) {
			const token = ROOM_TYPE_ID_TO_TOKEN[roomTypeId];
			if (token && token !== 'rr_other') {
				return RR_ROOM_TYPE_TOKENS[token] ?? defaultName;
			}
		}
		return defaultName;
	}

	const lower = trimmed.toLowerCase();

	if (lower === 'rr_other') return defaultName;

	const tokenLabel = RR_ROOM_TYPE_TOKENS[lower];
	if (tokenLabel !== undefined) return tokenLabel;

	const roomNMatch = /^room(\d{1,2})$/i.exec(trimmed);
	if (roomNMatch) return `Room${roomNMatch[1]}`;

	return trimmed;
}
