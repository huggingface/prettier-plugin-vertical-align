import type { Parser, Printer } from "prettier";
import tsParsers from "prettier/parser-typescript";
import babelParsers from "prettier/plugins/babel";
import { printer } from "./printer.js";
import { setOriginalPrinter } from "./original-printer.js";

export const parsers = {
	typescript: wrapParser(tsParsers.parsers.typescript),
	babel: wrapParser(babelParsers.parsers.babel),
	"babel-ts": wrapParser(babelParsers.parsers["babel-ts"]),
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
			options.printer = printer;
			return parser.preprocess?.(text, options) ?? text;
		}
	};
}