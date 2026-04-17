import type { AstPath, Doc } from "prettier";
import prettier from "prettier";

const { doc } = prettier;
const { hardline, indent } = doc.builders;

type Node = AstPath["node"];

export const compactAlignSymbol = Symbol("compactAlign");

let compactDepth = 0;

export function enterCompactDepth(): void {
	compactDepth++;
}

export function exitCompactDepth(): void {
	compactDepth--;
}

export function isInsideCompact(): boolean {
	return compactDepth > 0;
}

// --- Compact pattern config ---

let cachedConfig: { input: string[]; regexps: RegExp[]; maxLen: number } | null = null;

function getCompactConfig(patterns: string[]): { regexps: RegExp[]; maxLen: number } {
	if (!patterns || patterns.length === 0) return { regexps: [], maxLen: 0 };
	if (cachedConfig && cachedConfig.input === patterns) return cachedConfig;
	const regexps = patterns.filter(Boolean).map((p) => new RegExp(p));
	const maxLen = Math.max(...regexps.map((r) => r.source.length)) + 20;
	const result = { input: patterns, regexps, maxLen };
	cachedConfig = result;
	return result;
}

export function matchesCompactPattern(node: Node, options: any): boolean {
	const { regexps, maxLen } = getCompactConfig(options.compactFunctionCallPatterns);
	if (!regexps.length) return false;
	const start: number | undefined = node.start ?? node.range?.[0];
	if (start == null) return false;
	const prefix = options.originalText.slice(start, start + maxLen);
	return regexps.some((r) => r.test(prefix));
}

// --- Doc flattening ---

export function flattenDoc(d: Doc): Doc {
	if (typeof d === "string") return d;
	if (Array.isArray(d)) return d.map(flattenDoc);
	if (!d || typeof d !== "object") return d;

	switch ((d as any).type) {
		case "line":
			return (d as any).soft ? "" : " ";
		case "break-parent":
		case "line-suffix-boundary":
			return "";
		case "group":
		case "indent":
		case "align":
		case "indent-if-break":
		case "line-suffix":
		case "label":
			return flattenDoc((d as any).contents);
		case "if-break":
			return flattenDoc((d as any).flatContents ?? "");
		case "fill":
		case "concat":
			return (d as any).parts.map(flattenDoc);
		default:
			return d;
	}
}

// --- AST helpers ---

function nodeHasComments(node: Node): boolean {
	if (!node || typeof node !== "object") return false;
	if (Array.isArray(node.comments) && node.comments.length > 0) return true;
	for (const key of Object.keys(node)) {
		if (key === "loc" || key === "type" || key === "start" || key === "end" || key === "range" || key === "comments")
			continue;
		const val = node[key];
		if (Array.isArray(val)) {
			for (const item of val) {
				if (item && typeof item === "object" && item.type && nodeHasComments(item)) return true;
			}
		} else if (val && typeof val === "object" && val.type && nodeHasComments(val)) {
			return true;
		}
	}
	return false;
}

export function shouldSkipCompact(node: Node): boolean {
	return (
		nodeHasComments(node) ||
		node.arguments?.some(
			(arg: Node) =>
				arg.type === "FunctionExpression" ||
				(arg.type === "ArrowFunctionExpression" && arg.body?.type === "BlockStatement"),
		)
	);
}

// --- Compact call alignment ---

export function scanCompactCallGroups(node: Node, options: any): void {
	if (!getCompactConfig(options.compactFunctionCallPatterns).regexps.length) return;
	const maxArgs: number = options.compactFunctionCallMaxArgs || Infinity;

	const children: Node[] = node.body;
	if (!children || !Array.isArray(children)) return;

	let groups: Node[][] = [];
	let prevLine = -Infinity;

	for (const child of children) {
		const call =
			child.type === "ExpressionStatement" && child.expression?.type === "CallExpression"
				? child.expression
				: null;
		if (!call || !call.arguments || call.arguments.length === 0) {
			prevLine = -Infinity;
			continue;
		}

		if (!matchesCompactPattern(call, options) || shouldSkipCompact(call)) {
			prevLine = -Infinity;
			continue;
		}

		const childStart = child.loc.start.line;
		if (prevLine === -Infinity || (options.alignInGroups === "always" && prevLine !== childStart - 1)) {
			groups.push([]);
		}

		groups.at(-1)!.push(call);
		prevLine = child.loc.end.line;
	}

	for (const grp of groups.filter((g) => g.length > 1)) {
		const maxArgCount = Math.max(...grp.map((c) => c.arguments.length));
		const argWidths: number[] = [];

		let maxCalleeWidth = 0;
		for (const call of grp) {
			const calleeWidth = call.callee.loc.end.column - call.callee.loc.start.column;
			maxCalleeWidth = Math.max(maxCalleeWidth, calleeWidth);
		}

		const alignedArgCount = Math.min(maxArgCount, maxArgs - 1);
		for (let i = 0; i < alignedArgCount; i++) {
			let maxWidth = 0;
			for (const call of grp) {
				if (i < call.arguments.length) {
					const arg = call.arguments[i];
					if (i === 0 && arg.type === "ArrayExpression") continue;
					const width = arg.loc.end.column - arg.loc.start.column;
					maxWidth = Math.max(maxWidth, width);
				}
			}
			argWidths.push(maxWidth);
		}

		for (const call of grp) {
			call[compactAlignSymbol] = { argWidths, maxCalleeWidth };
		}
	}
}

/**
 * Appends printed args to `parts` with column-aligned padding separators.
 * `offset` maps printed arg index to original argument/argWidths index
 * (0 for normal args, 1 for remaining args after an array first-arg).
 */
function pushPaddedArgs(
	parts: Doc[],
	printedArgs: Doc[],
	nodeArgs: Node[],
	argWidths: number[],
	offset: number,
): void {
	for (let i = 0; i < printedArgs.length; i++) {
		parts.push(printedArgs[i]);
		if (i < printedArgs.length - 1) {
			const ai = i + offset;
			if (ai < argWidths.length) {
				const argWidth = nodeArgs[ai].loc.end.column - nodeArgs[ai].loc.start.column;
				parts.push("," + " ".repeat(Math.max(argWidths[ai] - argWidth, 0) + 1));
			} else {
				parts.push(", ");
			}
		}
	}
}

export function printAlignedCompactCall(
	node: Node,
	path: AstPath,
	_print: (path: AstPath) => Doc,
): Doc {
	const alignInfo = node[compactAlignSymbol] as { argWidths: number[]; maxCalleeWidth: number };
	const callee = flattenDoc(path.call(_print, "callee"));
	const calleeWidth = node.callee.loc.end.column - node.callee.loc.start.column;
	const calleePadding = alignInfo.maxCalleeWidth - calleeWidth;

	if (node.arguments[0]?.type === "ArrayExpression") {
		const elements: Doc[] = [];
		path.each((elemPath: AstPath, index: number) => {
			if (index > 0) elements.push(",", hardline);
			elements.push(elemPath.call(_print));
		}, "arguments", 0, "elements");
		const arrayDoc = ["[", indent([hardline, ...elements]), ",", hardline, "]"];
		const remainingArgs: Doc[] = [];
		for (let i = 1; i < node.arguments.length; i++) {
			remainingArgs.push(flattenDoc(path.call(_print, "arguments", i)));
		}

		// After the array group breaks, "]" lands at the base indent (same as callee).
		// We add "," then pad to reach the column where arg[1] starts in non-array calls.
		// That column (relative to base indent) = maxCalleeWidth + 1("(") + argWidths[0] + 2(", ")
		// After "]," we're at base indent + 2, so padding = maxCalleeWidth + argWidths[0] + 1
		const paddingAfterArray = alignInfo.maxCalleeWidth + (alignInfo.argWidths[0] || 0) + 1;

		const parts: Doc[] = [callee, " ".repeat(calleePadding) + "(", arrayDoc, ",", " ".repeat(paddingAfterArray)];
		pushPaddedArgs(parts, remainingArgs, node.arguments, alignInfo.argWidths, 1);
		parts.push(")");
		return parts;
	}

	const args: Doc[] = [];
	path.each((argPath: AstPath) => {
		args.push(flattenDoc(argPath.call(_print)));
	}, "arguments");

	const parts: Doc[] = [callee, " ".repeat(calleePadding) + "("];
	pushPaddedArgs(parts, args, node.arguments, alignInfo.argWidths, 0);
	parts.push(")");
	return parts;
}
