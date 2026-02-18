import { schema } from "../../src/index.js";

export const AtomicSchema = schema.create({
	val: schema.int32(),
});

export const MutexSchema = schema.create({
	lock: schema.mutex(),
	data: schema.int32(),
});
