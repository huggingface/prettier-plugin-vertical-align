import type { Printer } from "prettier";
import tsParsers from "prettier/parser-typescript";
import babelParsers from "prettier/plugins/babel";
import { printer } from "./printer.js";

export const parsers = {
	typescript: tsParsers.parsers.typescript,
	babel: babelParsers.parsers.babel,
	"babel-ts": babelParsers.parsers["babel-ts"],
};

export const printers: Record<string, Printer> = {
	estree: printer,
};
