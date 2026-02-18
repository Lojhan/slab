// benchmarks/flyweight.ts
import { StructCollection } from "../src/index.js";

const COUNT = 1_000_000;

const Def = { val: "int32" as const }; // Using int32 for direct typed array comparison
const collection = new StructCollection(Def, COUNT);

console.log(`Benchmarking ${COUNT} invocations...`);

// 1. JS Object Allocation
const t0 = performance.now();
let _sum = 0;
for (let i = 0; i < COUNT; i++) {
	const obj = { val: i };
	_sum += obj.val;
}
const t1 = performance.now();
console.log(`[JS Object] Allocate & Access: ${(t1 - t0).toFixed(2)}ms`);

// 2. Individual View Creation (Allocating)
const t2 = performance.now();
_sum = 0;
for (let i = 0; i < COUNT; i++) {
	const v = collection.get(i);
	v.val = i;
	_sum += v.val;
}
const t3 = performance.now();
console.log(`[Slab (Get)] collection.get(i): ${(t3 - t2).toFixed(2)}ms`);

// 3. Flyweight / Reusable View
const t4 = performance.now();
_sum = 0;
const view = collection.createView();
for (let i = 0; i < COUNT; i++) {
	view.use(i);
	view.val = i;
	_sum += view.val;
}
const t5 = performance.now();
console.log(
	`[Slab (Reuse)] view.__use(i): ${(t5 - t4).toFixed(2)}ms (Winner?)`,
);

// 4. Raw TypedArray
const t6 = performance.now();
const arr = new Int32Array(new SharedArrayBuffer(COUNT * 4));
_sum = 0;
for (let i = 0; i < COUNT; i++) {
	arr[i] = i;
	_sum += arr[i];
}
const t7 = performance.now();
console.log(`[Result] Raw Int32Array: ${(t7 - t6).toFixed(2)}ms (Baseline)`);
