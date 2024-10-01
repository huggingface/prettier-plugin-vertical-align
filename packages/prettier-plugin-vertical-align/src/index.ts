import type { Parser, ParserOptions, Printer, SupportOption, SupportOptions } from "prettier";
import tsParsers from "prettier/parser-typescript.js";
import babelParsers from "prettier/parser-babel.js";
import { printer } from "./printer.js";
import { setOriginalPrinter } from "./original-printer.js";

export const parsers = {
	typescript: wrapParser(tsParsers.parsers.typescript),
	babel: wrapParser(babelParsers.parsers.babel),
	"babel-ts": wrapParser(babelParsers.parsers["babel-ts"]),
};

export const options: SupportOptions = {
	alignInGroups: {
		type: "choice",
		category: "Global",
		default: "never",
		choices: [
			{
				value: "never",
				description: "Align every property inside an object on the same column.",
			},
			{
				value: "always",
				description:
					"Create groups based on blank lines or multi-line values. Properties in separate groups will not share alignment.",
			},
		],
		description: "Whether all properties in a group should align the same, or it's on a per-group basis.",
	},
};
// Do not export printers, as prettier does not allow composing printers.
// Instead we wrap the original printer

// export const printers: Record<string, Printer> = {
// 	estree: printer,
// };

function wrapParser<T extends Parser>(parser: T): T {
	return {
		...parser,
		preprocess(text, options) {
			setOriginalPrinter(options.printer as Printer);
			options.printer = {
				...(options.printer as Printer),
				...printer,
			};
			return parser.preprocess?.(text, options) ?? text;
		},
	};
}
