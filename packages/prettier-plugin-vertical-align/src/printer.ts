import type { Printer } from "prettier";
import { inspect } from "node:util";
import { doc } from "prettier";
import { getOriginalPrinter } from "./original-printer.js";

const {
	group,
	indent,
	join,
	line,
	softline,
	breakParent,
	cursor,
	hardline,
	hardlineWithoutBreakParent,
	lineSuffixBoundary,
	literalline,
	literallineWithoutBreakParent,
	trim,
	addAlignmentToDoc,
	align,
	conditionalGroup,
	dedent,
	dedentToRoot,
	fill,
	ifBreak,
	indentIfBreak,
	label,
	lineSuffix,
	markAsRoot,
} = doc.builders;

let hasPrinted = false;

const keyLengthSymbol = Symbol("keyLength");

export const printer: Printer = {
	print(path, options, _print,...args) {
		// const originalPrinter = options.printer as Printer;

		const node = path.node;

		if (node.type === "Property") {
			if (!node[keyLengthSymbol]) {
				return getOriginalPrinter().print(path, options, _print, ...args);
			}

			const keyLength = node[keyLengthSymbol];
			const addedLength = keyLength - (node.key.loc.end.column - node.key.loc.start.column);

			// console.log("keyLength", keyLength);

			return group([
				path.call(_print, "key"),
				":" + " ".repeat(addedLength + 1),
				path.call(_print, "value"),
			]);
		}

		if (node.type !== "ObjectExpression" || node.properties.length <= 1) {
			return getOriginalPrinter().print(path, options, _print, ...args);
		}

		if (node.type === "ObjectExpression") {
			hasPrinted = true;
			// console.log("node", inspect(node, {depth: 10}));

			const multipleLines = node.properties[1].loc.start.line !== node.properties[0].loc.start.line;

			if (!multipleLines) {
				return getOriginalPrinter().print(path, options, _print, ...args);
			}

			let keyLength = 0;
			for (const property of node.properties) {
				if (property.key.loc.start.line === property.key.loc.end.line) {
					keyLength = Math.max(keyLength, property.key.loc.end.column - property.key.loc.start.column);
				}
			}

			for (const property of node.properties) {
				if (property.loc.start.line === property.loc.end.line) {
					property[keyLengthSymbol] = keyLength;
				}
			}
		}

		return getOriginalPrinter().print(path, options, _print, ...args);
	},
};
