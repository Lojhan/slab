// benchmarks/sparse-set.ts
import { SparseSet, StructCollection } from "../src/index.js";

const COUNT = 1_000_000;
const MAX_ID = COUNT * 2; // Sparse ID space

const Def = { val: "int32" as const };
const collection = new StructCollection(Def, COUNT);
const sparseSet = new SparseSet(collection, MAX_ID);

console.log(`Benchmarking SparseSet vs Map with ${COUNT} entities...`);

// 1. Map (Baseline)
const map = new Map<number, { val: number }>();

const t0 = performance.now();
for (let i = 0; i < COUNT; i++) {
	map.set(i * 2, { val: i });
}
const t1 = performance.now();
console.log(`[Map] Insert: ${(t1 - t0).toFixed(2)}ms`);

// 2. SparseSet Insert
const t2 = performance.now();
const writeView = collection.createView();
for (let i = 0; i < COUNT; i++) {
	// Add entity ID (i*2), set value
	const index = sparseSet.add(i * 2);
	// Use reused view
	writeView.use(index.val);
	writeView.val = i;
}
const t3 = performance.now();
console.log(`[SparseSet] Add (incl. value set): ${(t3 - t2).toFixed(2)}ms`);

// Start iteration benchmark
const t4 = performance.now();
let _sum = 0;
for (const v of map.values()) {
	_sum += v.val;
}
const t5 = performance.now();
console.log(`[Map] Iterate Values: ${(t5 - t4).toFixed(2)}ms`);

// SparseSet Dense Iteration
const t6 = performance.now();
_sum = 0;
const view = collection.createView();
const count = sparseSet.count;
for (let i = 0; i < count; i++) {
	view.use(i);
	_sum += view.val;
}
const t7 = performance.now();
console.log(
	`[SparseSet] Dense Iteration (Cache Friendly): ${(t7 - t6).toFixed(2)}ms`,
);

// Random Access
const t8 = performance.now();
_sum = 0;
for (let i = 0; i < COUNT; i++) {
	// Lookup by entity ID (i*2)
	const v = map.get(i * 2);
	if (v) _sum += v.val;
}
const t9 = performance.now();
console.log(`[Map] Random Lookup: ${(t9 - t8).toFixed(2)}ms`);

const t10 = performance.now();
_sum = 0;
const view2 = collection.createView();
for (let i = 0; i < COUNT; i++) {
	const idx = sparseSet.get(i * 2);
	if (idx?.val && idx?.val !== -1) {
		view2.use(idx.val);
		_sum += view2.val;
	}
}
const t11 = performance.now();
console.log(
	`[SparseSet] Random Lookup (Sparse->Dense): ${(t11 - t10).toFixed(2)}ms`,
);
