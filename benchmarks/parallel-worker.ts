import { StructCollection } from "../src/index.js";

import { COUNT, PlayerDef } from "./constants.js";

declare var self: Worker;

self.onmessage = (event: MessageEvent) => {
	const { type, payload, start, end } = event.data;

	if (type === "struct") {
		const buffer = payload as SharedArrayBuffer;
		// Reconstruct the collection view from the buffer
		// Note: capacity must match original allocation
		const capacity = COUNT;
		const players = new StructCollection(PlayerDef, capacity, buffer);

		// Process range
		for (let i = start; i < end; i++) {
			const p = players.get(i);
			p.x += 1.0;
			p.y *= 0.99;
		}

		postMessage("done");
	} else if (type === "native") {
		const players = payload as Record<string, number>[];

		for (let i = 0; i < players.length; i++) {
			const p = players[i];
			p.x += 1.0;
			p.y *= 0.99;
		}

		postMessage({ type: "done", payload: players });
	}
};
