import { StructCollection } from "../src/index.js";

const COUNT = 1_000_000;

const mode = process.argv[2] as "atomic" | "mutex";

if (!mode) {
	console.error("Usage: bun run benchmarks/concurrency.ts <atomic|mutex>");
	process.exit(1);
}

if (mode === "atomic") {
	const Def = { val: "int32" as const };
	const collection = new StructCollection(Def, COUNT);
	const view = collection.createView();

	// Non-atomic baseline
	const t0 = performance.now();
	for (let i = 0; i < COUNT; i++) {
		view.use(i);
		view.val += 1;
	}
	const t1 = performance.now();
	console.log(`[ATOMIC] Non-atomic increment: ${(t1 - t0).toFixed(2)}ms`);

	// Atomic increment
	const t2 = performance.now();
	// biome-ignore lint/suspicious/noExplicitAny: Benchmark hack
	const v: any = view;
	for (let i = 0; i < COUNT; i++) {
		v.use(i);
		v.atomicAddVal(1);
	}
	const t3 = performance.now();
	console.log(`[ATOMIC] Atomic increment: ${(t3 - t2).toFixed(2)}ms`);

	// Compare Exchange
	const t4 = performance.now();
	for (let i = 0; i < COUNT; i++) {
		v.use(i);
		// expected, replacement
		v.atomicCompareExchangeVal(i + 1, i + 2);
	}
	const t5 = performance.now();
	console.log(`[ATOMIC] CompareExchange: ${(t5 - t4).toFixed(2)}ms`);
}

if (mode === "mutex") {
	const Def = { lock: "mutex" as const, data: "int32" as const };
	const collection = new StructCollection(Def, COUNT);
	const view = collection.createView();
	// biome-ignore lint/suspicious/noExplicitAny: Benchmark hack
	const v: any = view;

	console.log(`[MUTEX] Testing locking overhead (single thread)`);

	const t0 = performance.now();
	for (let i = 0; i < COUNT; i++) {
		v.use(i);
		v.lockLock();
		v.data += 1;
		v.unlockLock();
	}
	const t1 = performance.now();
	console.log(`[MUTEX] Lock/Unlock cycle: ${(t1 - t0).toFixed(2)}ms`);

	// Try Lock
	const t2 = performance.now();
	let _success = 0;
	for (let i = 0; i < COUNT; i++) {
		v.use(i);
		if (v.tryLockLock()) {
			v.data += 1;
			v.unlockLock();
			_success++;
		}
	}
	const t3 = performance.now();
	console.log(`[MUTEX] TryLock cycle: ${(t3 - t2).toFixed(2)}ms`);
}
