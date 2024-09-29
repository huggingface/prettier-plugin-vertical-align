import type { AstPath, Printer } from "prettier";
import { inspect } from "node:util";

const inspected = new Set<AstPath>();

export const printer: Printer = {
	print(path, options, _print) {
		const node = path.node;

		if (!inspected.has(path)) {
			inspected.add(path);
			console.log("path", node.type);
		}

		const x = _print(path.node);
		return x;
	},
};
