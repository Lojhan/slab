// soa.ts
import { StructCollection } from "../src/index.js";

const COUNT = 1_000_000;

// Simple schema (like positions)
const PositionDef = {
	x: "float64" as const,
	y: "float64" as const,
	z: "float64" as const,
	w: "float64" as const,
	vx: "float64" as const,
	vy: "float64" as const,
};

const MODE = process.argv[2] as "aos" | "soa";

if (!MODE) {
	console.error("Usage: bun run benchmarks/soa.ts <aos|soa>");
	process.exit(1);
}

const collection = new StructCollection(PositionDef, COUNT, undefined, {
	layout: MODE,
});

// Reuse view to avoid overhead
const view = collection.createView();

// Write
const startWrite = performance.now();
for (let i = 0; i < COUNT; i++) {
	view.use(i);
	view.x = i;
	view.y = i * 0.5;
	view.z = i * 0.25;
	view.w = 1.0;
	view.vx = 0.1;
	view.vy = 0.1;
}
const endWrite = performance.now();
console.log(
	`[${MODE.toUpperCase()}] Write (${COUNT} items): ${(
		endWrite - startWrite
	).toFixed(2)}ms`,
);

// Read (sequential access - best case for SoA if iterating component-wise, worst case if iterating entity-wise)
// We simulate a system that iterates over all entities and updates position based on velocity
const startRead = performance.now();
let result = 0;

// Hot loop
for (let i = 0; i < COUNT; i++) {
	view.use(i);
	// Accessing multiple fields per entity is typically better for AoS
	// But SoA might win due to prefetching if fields are stored contiguously
	view.x += view.vx;
	view.y += view.vy;
	result += view.x;
}
const endRead = performance.now();
console.log(
	`[${MODE.toUpperCase()}] Read/Update (${COUNT} items): ${(
		endRead - startRead
	).toFixed(2)}ms`,
);
console.log(`Result: ${result}`); // Prevent dead code elimination
