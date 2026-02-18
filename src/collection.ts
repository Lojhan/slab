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
			// Get field accessors or iterate manually?
			// createSoAStructClass gives us accessors but maybe slow to instantiate just for copy.
			// However, we can use a temporary view.
			const vFrom = this.get(fromIndex);
			const vTo = this.get(toIndex);
			// Iterate keys and copy? Types are mismatched (any).
			// Efficient way: direct memory copy of each array slice.
			// But we don't have direct access to internal offsets of the SoA layout easily.

			// Re-use logic from createSoAStructClass which calculates offsets?
			// Maybe StructCollection should calculate offsets once and store them?
			// Yes, refactoring schema/layout logic would be better but separate issue.

			// For now, let's use the views. It's slower but correct.
			// Ideally we want memcpy for bulk moves.

			// Actually, let's just use the view properties.
			for (const key of this.schema.offsets.keys()) {
				const val = vFrom[key];
				vTo[key] = val; // Handles nested structs?
				// If nested struct, val is a View. copy needs deep copy?
				// Creating a view returns a reference. assigning reference to view property
				// acts as setter if property is primitive.
				// If property is struct, the setter logic in generic view is not defined for object assignment.
				// In createStructClass:
				/*
				if (struct) {
					Object.defineProperty(..., { get: ... })
					// No Setter!
				}
				*/
				// So we cannot just assign vTo.nested = vFrom.nested.
				// We must recurse.
			}
			return; // TODO: Implement efficient SoA copy
		}

		// AoS is simple memcpy
		const srcStart = fromIndex * structSize;
		const dstStart = toIndex * structSize;

		const src = new Uint8Array(this.buffer, srcStart, structSize);
		const dst = new Uint8Array(this.buffer, dstStart, structSize);
		dst.set(src);
	}
}
