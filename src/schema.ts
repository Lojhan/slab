import {
	type SchemaDefinition,
	type SchemaField,
	TYPE_SIZES,
} from "./types.js";

/**
 * Calculates the memory layout for a given schema definition.
 * It determines the offsets and total size of the struct, recursively handling nested schemas.
 */
export class Schema<T extends SchemaDefinition> {
	/** Total size of the struct in bytes. */
	public readonly size: number;
	/** Map of field names to their byte offset within the struct. */
	public readonly offsets: Map<keyof T, number>;
	/** Ordered list of fields and their definitions. */
	public readonly fields: [keyof T, SchemaField][];
	/** Alignment requirement for this struct. */
	public readonly alignment: number;

	/**
	 * Creates a new Schema instance.
	 * @param definition The schema definition object.
	 */
	constructor(public definition: T) {
		this.offsets = new Map();
		this.fields = Object.entries(definition);

		let currentOffset = 0;
		let maxAlignment = 1;

		for (const [key, type] of this.fields) {
			let size = 0;
			let align = 1;

			if (typeof type === "string") {
				size = TYPE_SIZES[type];
				align = size;
			} else if (type.type === "string") {
				size = type.length;
				align = 1;
			} else if (type.type === "struct") {
				const nestedSchema = new Schema(type.definition);
				size = nestedSchema.size;
				align = nestedSchema.alignment;
			}

			if (align > maxAlignment) maxAlignment = align;

			// Add padding
			if (currentOffset % align !== 0) {
				currentOffset += align - (currentOffset % align);
			}

			this.offsets.set(key, currentOffset);
			currentOffset += size;
		}

		// Align total size to struct alignment (so arrays are packed correctly)
		if (currentOffset % maxAlignment !== 0) {
			currentOffset += maxAlignment - (currentOffset % maxAlignment);
		}

		this.size = currentOffset;
		this.alignment = maxAlignment;
	}
}
