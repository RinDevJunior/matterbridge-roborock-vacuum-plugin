export interface LegacyRobotPosition {
	x: number; // robot coordinates, mm
	y: number; // robot coordinates, mm
	angle: number; // degrees
}

export interface LegacySegmentInfo {
	id: number;
	name: string;
	center: [number, number]; // [x_mm, y_mm] centroid of segment bounding box
	boundingBox: { minX: number; maxX: number; minY: number; maxY: number }; // pixel-space bounding box, relative to image origin — same convention as resolveCurrentRoom's pxRel/pyRel
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

export interface LegacyWallLine {
	x1: number;
	y1: number;
	x2: number;
	y2: number; // raw mm, robot coordinate space (same as robotPosition)
}

export interface LegacyZoneQuad {
	points: [number, number][]; // exactly 4 raw-mm (x,y) corners, wire order preserved
}

export interface LegacyMapData {
	robotPosition?: LegacyRobotPosition;
	chargerPosition?: LegacyRobotPosition;
	image?: LegacyImageBlock;
	currentlyCleanedBlocks?: number[]; // segment IDs in the active cleaning task
	virtualWalls?: LegacyWallLine[]; // decoded block type 10
	noGoZones?: LegacyZoneQuad[]; // decoded block type 9
	noMopZones?: LegacyZoneQuad[]; // decoded block type 12
}
