export interface LegacyRobotPosition {
	x: number; // robot coordinates, mm
	y: number; // robot coordinates, mm
	angle: number; // degrees
}

export interface LegacySegmentInfo {
	id: number;
	name: string;
	center: [number, number]; // [x_mm, y_mm] centroid of segment bounding box
}

export interface LegacyImageBlock {
	position: { top: number; left: number }; // image block origin, pixel units (50mm each)
	dimensions: { width: number; height: number }; // pixel units
	pixels: {
		floor: number[]; // linear pixel indices of floor pixels
		obstacle: number[]; // linear pixel indices of obstacle pixels
		segments: number[]; // packed: (linearIndex & 0x1FFFFF) | (segmentId << 21)
	};
	segments: {
		count: number;
		list: LegacySegmentInfo[];
	};
}

export interface LegacyMapData {
	robotPosition?: LegacyRobotPosition;
	chargerPosition?: LegacyRobotPosition;
	image?: LegacyImageBlock;
	currentlyCleanedBlocks?: number[]; // segment IDs in the active cleaning task
}
