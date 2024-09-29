import type { Printer } from "prettier";
// import { inspect } from "node:util";
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

export const printer: Printer = {
	print(path, options, _print,...args) {
		// const originalPrinter = options.printer as Printer;

		const node = path.node;

		// console.log("node type", node.type);

		// if (node.type === "Identifier") {
		// 	console.log("identifier", node);
		// 	return node.name+ "_bis";
		// }

		return getOriginalPrinter().print(path, options, _print, ...args);

		// if (!inspected.has(path)) {
		// 	inspected.add(path);
		// 	console.log("\npath\n");
		// 	// console.log("path", node.type, inspect(node, { depth: 10 }));
		// }

		// return path.map(_print, "children");

		//return originalPrinter.print(path, options, _print);
	},
};
