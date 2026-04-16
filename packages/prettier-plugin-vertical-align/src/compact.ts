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

// --- Compact align config ---

let cachedPatterns: { input: string[]; regexps: RegExp[] } | null = null;

function parseCompactPatterns(patterns: string[]): RegExp[] {
	if (!patterns || patterns.length === 0) return [];
	if (cachedPatterns && cachedPatterns.input === patterns) return cachedPatterns.regexps;
	const regexps = patterns.filter(Boolean).map((p) => new RegExp(p));
	cachedPatterns = { input: patterns, regexps };
	return regexps;
}

let cachedLineOffsets: { text: string; offsets: number[] } | null = null;

function getLineOffsets(text: string): number[] {
	if (cachedLineOffsets && cachedLineOffsets.text === text) return cachedLineOffsets.offsets;
	const offsets = [0];
	for (let i = 0; i < text.length; i++) {
		if (text[i] === "\n") offsets.push(i + 1);
	}
	cachedLineOffsets = { text, offsets };
	return offsets;
}

function getNodeSourcePrefix(node: Node, originalText: string, lineOffsets: number[], maxLen: number): string {
	if (!node.loc) return "";
	const charOffset = lineOffsets[node.loc.start.line - 1] + node.loc.start.column;
	return originalText.slice(charOffset, charOffset + maxLen);
}

export function matchesCompactPattern(node: Node, options: any): boolean {
	const patterns = parseCompactPatterns(options.compactFunctionCallPatterns);
	if (patterns.length === 0) return false;
	if (!node.loc) return false;
	const lineOffsets = getLineOffsets(options.originalText);
	const maxLen = Math.max(...patterns.map((r) => r.source.length)) + 20;
	const prefix = getNodeSourcePrefix(node, options.originalText, lineOffsets, maxLen);
	return patterns.some((r) => r.test(prefix));
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
			return "";
		case "group":
			return flattenDoc((d as any).contents);
		case "indent":
			return flattenDoc((d as any).contents);
		case "align":
			return flattenDoc((d as any).contents);
		case "if-break":
			return flattenDoc((d as any).flatContents ?? "");
		case "fill":
			return (d as any).parts.map(flattenDoc);
		case "concat":
			return (d as any).parts.map(flattenDoc);
		case "indent-if-break":
			return flattenDoc((d as any).contents);
		case "line-suffix":
			return flattenDoc((d as any).contents);
		case "line-suffix-boundary":
			return "";
		case "label":
			return flattenDoc((d as any).contents);
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

function callHasBlockFunctionArg(node: Node): boolean {
	return node.arguments?.some(
		(arg: Node) =>
			arg.type === "FunctionExpression" ||
			(arg.type === "ArrowFunctionExpression" && arg.body?.type === "BlockStatement"),
	);
}

export function shouldSkipCompact(node: Node): boolean {
	return nodeHasComments(node) || callHasBlockFunctionArg(node);
}

// --- Compact call alignment ---

function isStatementContainer(node: Node): boolean {
	return node.type === "Program" || node.type === "BlockStatement";
}

export function isCompactStatementContainer(node: Node): boolean {
	return isStatementContainer(node);
}

function getCallFromStatement(child: Node): Node | null {
	if (child.type === "ExpressionStatement" && child.expression?.type === "CallExpression") {
		return child.expression;
	}
	return null;
}

export function scanCompactCallGroups(node: Node, options: any): void {
	const patterns = parseCompactPatterns(options.compactFunctionCallPatterns);
	if (patterns.length === 0) return;
	const maxArgs: number = options.compactFunctionCallMaxArgs || Infinity;

	const children: Node[] = node.body;
	if (!children || !Array.isArray(children)) return;

	const lineOffsets = getLineOffsets(options.originalText);
	const maxLen = Math.max(...patterns.map((r) => r.source.length)) + 20;

	let groups: Node[][] = [];
	let prevLine = -Infinity;

	for (const child of children) {
		const call = getCallFromStatement(child);
		if (!call || !call.arguments || call.arguments.length === 0) {
			prevLine = -Infinity;
			continue;
		}

		const prefix = getNodeSourcePrefix(call, options.originalText, lineOffsets, maxLen);
		if (!patterns.some((r) => r.test(prefix)) || shouldSkipCompact(call)) {
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

export function printAlignedCompactCall(
	node: Node,
	path: AstPath,
	options: any,
	_print: (path: AstPath) => Doc,
): Doc {
	const alignInfo = node[compactAlignSymbol] as { argWidths: number[]; maxCalleeWidth: number };
	const callee = flattenDoc(path.call(_print, "callee"));
	const calleeWidth = node.callee.loc.end.column - node.callee.loc.start.column;
	const calleePadding = alignInfo.maxCalleeWidth - calleeWidth;

	const firstArgIsArray = node.arguments[0]?.type === "ArrayExpression";

	if (firstArgIsArray) {
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
		for (let i = 0; i < remainingArgs.length; i++) {
			parts.push(remainingArgs[i]);
			if (i < remainingArgs.length - 1) {
				const argIdx = i + 1;
				if (argIdx < alignInfo.argWidths.length) {
					const arg = node.arguments[i + 1];
					const argWidth = arg.loc.end.column - arg.loc.start.column;
					const padding = Math.max(alignInfo.argWidths[argIdx] - argWidth, 0);
					parts.push("," + " ".repeat(padding + 1));
				} else {
					parts.push(", ");
				}
			}
		}
		parts.push(")");
		return parts;
	}

	const args: Doc[] = [];
	path.each((argPath: AstPath) => {
		args.push(flattenDoc(argPath.call(_print)));
	}, "arguments");

	const parts: Doc[] = [callee, " ".repeat(calleePadding) + "("];
	for (let i = 0; i < args.length; i++) {
		parts.push(args[i]);
		if (i < args.length - 1) {
			if (i < alignInfo.argWidths.length) {
				const arg = node.arguments[i];
				const argWidth = arg.loc.end.column - arg.loc.start.column;
				const padding = Math.max(alignInfo.argWidths[i] - argWidth, 0);
				parts.push("," + " ".repeat(padding + 1));
			} else {
				parts.push(", ");
			}
		}
	}
	parts.push(")");
	return parts;
}
