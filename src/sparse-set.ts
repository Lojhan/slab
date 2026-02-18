import type { StructCollection } from "./collection.js";
import type { InferSchema, SchemaDefinition } from "./types.js";

/**
 * Implements a Sparse Set data structure for efficient Entity ID to Component mapping.
 * Ensures data locality (dense packing) while allowing O(1) random access by Entity ID.
 * Supports concurrent access via shared buffers.
 */
export class SparseSet<T extends SchemaDefinition> {
	private dense: StructCollection<T>;
	private sparse: Int32Array; // Maps Entity ID -> Dense Index (-1 if invalid)
	private denseToEntity: Int32Array; // Maps Dense Index -> Entity ID (for swap-remove)
	private _count: Int32Array; // Current number of active entities in dense array

	public get buffers() {
		return {
			sparse: this.sparse.buffer as SharedArrayBuffer,
			denseToEntity: this.denseToEntity.buffer as SharedArrayBuffer,
			count: this._count.buffer as SharedArrayBuffer,
		};
	}

	/**
	 * @param collection The underlying dense storage for component data.
	 * @param maxEntityID The maximum possible Entity ID value (determines sparse array size).
	 * @param existingBuffers Optional shared buffers (for worker hydration).
	 */
	constructor(
		collection: StructCollection<T>,
		maxEntityID: number,
		existingBuffers?: {
			sparse: SharedArrayBuffer;
			denseToEntity: SharedArrayBuffer;
			count: SharedArrayBuffer;
		},
	) {
		this.dense = collection;

		if (existingBuffers) {
			this.sparse = new Int32Array(existingBuffers.sparse);
			this.denseToEntity = new Int32Array(existingBuffers.denseToEntity);
			this._count = new Int32Array(existingBuffers.count);
		} else {
			// Allocate sparse array (Entity ID -> Index)
			// Using SharedArrayBuffer allows multiple workers to read/write mappings
			const sparseBuffer = new SharedArrayBuffer((maxEntityID + 1) * 4);
			this.sparse = new Int32Array(sparseBuffer);
			this.sparse.fill(-1);

			// Allocate dense-to-entity map (Index -> Entity ID)
			// Size matches collection capacity
			const mapBuffer = new SharedArrayBuffer(collection.capacity * 4);
			this.denseToEntity = new Int32Array(mapBuffer);

			// Shared counter for atomic access
			const countBuffer = new SharedArrayBuffer(4);
			this._count = new Int32Array(countBuffer);
		}
	}

	get count(): number {
		return Atomics.load(this._count, 0);
	}

	/**
	 * Adds a component for the given entity ID.
	 * Returns a view to the newly allocated component data.
	 * If entity already has component, returns existing view.
	 */
	add(entityID: number): InferSchema<T> {
		const existingIndex = Atomics.load(this.sparse, entityID);
		if (existingIndex !== -1) {
			return this.dense.get(existingIndex);
		}

		// Reserve new slot atomically
		// Note: basic increment is not fully thread-safe for slot allocation if multiple threads ADD simultaneously
		// Without a lock, two threads could claim the same index.
		// For now, assuming single-threaded ADD or external lock.
		// A true concurrent push requires CAS loop on count.

		const index = Atomics.add(this._count, 0, 1);

		if (index >= this.dense.capacity) {
			Atomics.sub(this._count, 0, 1); // Revert
			throw new Error("Collection capacity exceeded");
		}

		// Update mappings
		Atomics.store(this.sparse, entityID, index);
		Atomics.store(this.denseToEntity, index, entityID);

		// Get view and return (this allows immediate initialization)
		// Optimization: Return a zeroed view?
		// For now, just return view pointing to memory (might be dirty from previous usage).
		// Caller should initialize fields.
		return this.dense.get(index);
	}

	/**
	 * Checks if the entity has this component.
	 */
	has(entityID: number): boolean {
		return Atomics.load(this.sparse, entityID) !== -1;
	}

	/**
	 * Returns the component data for the given entity.
	 * Returns undefined if not present.
	 */
	get(entityID: number): InferSchema<T> | undefined {
		// Valid check
		if (entityID < 0 || entityID >= this.sparse.length) return undefined;

		const index = Atomics.load(this.sparse, entityID);
		if (index === -1) return undefined;

		return this.dense.get(index);
	}

	/**
	 * Removes the component for the given entity.
	 * Swaps the last element into the hole to maintain density.
	 */
	remove(entityID: number): void {
		const index = Atomics.load(this.sparse, entityID);
		if (index === -1) return;

		// Decrement count to get the last element's index
		const lastIndex = Atomics.sub(this._count, 0, 1) - 1;

		if (index !== lastIndex) {
			// Swap last element into the hole
			const lastEntityID = Atomics.load(this.denseToEntity, lastIndex);

			// 1. Move data in dense array
			this.dense.copy(lastIndex, index);

			// 2. Update mappings
			Atomics.store(this.sparse, lastEntityID, index);
			Atomics.store(this.denseToEntity, index, lastEntityID);
		}

		// Clear the removed entity's mapping
		Atomics.store(this.sparse, entityID, -1);
	}
}
