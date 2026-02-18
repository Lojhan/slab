export const PositionSchema = {
	x: "float64" as const,
	y: "float64" as const,
	z: "float64" as const,
	w: "float64" as const,
	vx: "float64" as const,
	vy: "float64" as const,
};

export type PositionDef = typeof PositionSchema;
