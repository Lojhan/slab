import { Schema } from "./schema.js";
import type { InferSchema, SchemaDefinition } from "./types.js";
import { createSoAStructClass, createStructClass } from "./view.js";

type CollectionOptions = {
	layout?: "aos" | "soa";
};

/**
 * Manages a collection of structs stored contiguously in a single `SharedArrayBuffer`.
 * This allows for zero-copy data sharing between agents (e.g. Workers).
 *
 * @template T The schema definition.
 */
export class StructCollection<T extends SchemaDefinition> {
	/** Bytestring buffer backing this collection. */
	public buffer: SharedArrayBuffer;
	/** schema definition used for layout calculation. */
	private schema: Schema<T>;
	// biome-ignore lint/suspicious/noExplicitAny: Dynamic class generation
	private StructClass: any;
	public readonly capacity: number;
	private layout: "aos" | "soa";

	/**
	 * Allocates a new StructCollection or wraps an existing buffer.
	 *
	 * @param schemaDef The schema definition for the structs in this collection.
	 * @param capacity The maximum number of structs this collection can hold.
	 * @param existingBuffer Optional. A `SharedArrayBuffer` to use instead of allocating a new one.
	 *                       Must be large enough to hold `capacity * schema.size` bytes.
	 * @param options Configuration options.
	 */
	constructor(
		schemaDef: T,
		capacity: number,
		existingBuffer?: SharedArrayBuffer,
		options?: CollectionOptions,
	) {
		this.schema = new Schema(schemaDef);
		this.capacity = capacity;
		this.layout = options?.layout ?? "aos";

		if (this.layout === "soa") {
			this.StructClass = createSoAStructClass(this.schema, capacity);
		} else {
			this.StructClass = createStructClass(this.schema);
		}

		if (existingBuffer) {
			this.buffer = existingBuffer;
			return;
		}

		const byteLength = this.schema.size * capacity;
		this.buffer = new SharedArrayBuffer(byteLength);
	}

	/**
	 * Returns a view (proxy) for the struct at the given index.
	 * Modifications to the returned object are immediately reflected in the buffer.
	 *
	 * @param index The zero-based index of the struct to access.
	 * @throws Error if the index is out of bounds.
	 * @returns The struct instance.
	 */
	get(index: number): InferSchema<T> {
		if (index >= this.capacity) throw new Error("Index out of bounds");

		if (this.layout === "soa") {
			const view = new this.StructClass(this.buffer, 0);
			view.__use(index);
			return view;
		}

		const offset = index * this.schema.size;
		return new this.StructClass(this.buffer, offset);
	}

	/**
	 * Creates a reusable view instance.
	 * Call `view.use(index)` to move the cursor to a specific entity.
	 */
	createView(): InferSchema<T> & { use(index: number): InferSchema<T> } {
		const view = new this.StructClass(this.buffer, 0);
		// Add a public 'use' method that delegates to __use
		// This keeps the internal __use private-ish but exposes a documented API
		Object.defineProperty(view, "use", {
			value: function (index: number) {
				this.__use(index);
				return this;
			},
			enumerable: false,
			writable: false,
		});
		return view;
	}

	/**
	 * Copies data from one index to another within the collection.
	 * Used for swap-remove operations.
	 */
	copy(fromIndex: number, toIndex: number): void {
		if (fromIndex === toIndex) return;

		const structSize = this.schema.size;

		if (this.layout === "soa") {
			const vFrom = this.get(fromIndex);
			const vTo = this.get(toIndex);
			this.copySoA(this.schema.definition, vFrom, vTo);
			return;
		}

		// AoS is simple memcpy
		const srcStart = fromIndex * structSize;
		const dstStart = toIndex * structSize;

		const src = new Uint8Array(this.buffer, srcStart, structSize);
		const dst = new Uint8Array(this.buffer, dstStart, structSize);
		dst.set(src);
	}

	private copySoA<T extends SchemaDefinition>(
		def: SchemaDefinition,
		from: InferSchema<T>,
		to: InferSchema<T>,
	): void {
		for (const key in def) {
			const field = def[key];
			if (typeof field === "object" && field.type === "struct") {
				this.copySoA(
					field.definition,
					from[key] as SchemaDefinition,
					to[key] as SchemaDefinition,
				);
			} else {
				(to as Record<string, unknown>)[key] = from[key];
			}
		}
	}
}
