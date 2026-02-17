import { Schema } from "./schema.js";
import type { InferSchema, SchemaDefinition } from "./types.js";
import { createStructClass } from "./view.js";

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
	private capacity: number;

	/**
	 * Allocates a new StructCollection or wraps an existing buffer.
	 *
	 * @param schemaDef The schema definition for the structs in this collection.
	 * @param capacity The maximum number of structs this collection can hold.
	 * @param existingBuffer Optional. A `SharedArrayBuffer` to use instead of allocating a new one.
	 *                       Must be large enough to hold `capacity * schema.size` bytes.
	 */
	constructor(
		schemaDef: T,
		capacity: number,
		existingBuffer?: SharedArrayBuffer,
	) {
		this.schema = new Schema(schemaDef);
		this.StructClass = createStructClass(this.schema);
		this.capacity = capacity;

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
		const offset = index * this.schema.size;
		return new this.StructClass(this.buffer, offset);
	}
}
