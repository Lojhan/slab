import { schema } from "../src/index.js";

export const COUNT = 1_000_000;
export const WORKERS = 4;
export const CHUNK = COUNT / WORKERS;

export const PlayerDef = schema.create({
	id: schema.uint32(),
	health: schema.uint8(),
	x: schema.float64(),
	y: schema.float64(),
	active: schema.boolean(),
	name: schema.string(16),
}).definition;
