import type { AstPath, Doc, Printer } from "prettier";
import { getOriginalPrinter } from "./original-printer.js";

type Node = AstPath["node"];

/** Number of spaces to add after the ":" of a property, set by the printer of its parent. */
const paddingSymbol = Symbol("padding");

export const printer: Printer = {
	print(path, options, _print, ...args) {
		// const originalPrinter = options.printer as Printer;

		const node = path.node;

		// See https://github.com/huggingface/prettier-plugin-vertical-align/issues/5
		if (!node) {
			return getOriginalPrinter().print(path, options, _print, ...args);
		}

		// if (node.comments) {
		// 	console.log("!!COMMENTS");
		// }

		// if (node.type === "Program") {
		//   console.log("node", inspect(node.body, { depth: 10 }));
		// }

		const padding = node[paddingSymbol];
		if (padding) {
			// Let prettier print the property - so that the key, the quotes around it and the layout of the value
			// are exactly the ones prettier would use - and only widen the ":" separator of the doc it returns.
			return addPaddingAfterColon(getOriginalPrinter().print(path, options, _print, ...args), padding);
		}

		if (isPropertyContainer(node)) {
			let groups: Node[][] = [];

			// console.log("node", node);
			// console.log("node", inspect(node, {depth: 10}));
			const properties: Node[] = nodeProperties(node);

			// The container is only aligned if it is printed on multiple lines. Prettier decides that from the
			// presence of a newline between the "{" and the first member in the *original* text, so this
			// predicate is stable under re-formatting.
			if (properties.length && !isExpanded(node, properties, options)) {
				return getOriginalPrinter().print(path, options, _print, ...args);
			}

			let prev: Node | undefined;
			for (const prop of properties) {
				if (
					!prev ||
					(options.alignInGroups === "always" && (hasBlankLineBetween(prev, prop, options) || forcesBreak(prev, options)))
				) {
					groups.push([]);
				}

				// Shorthands and methods are not aligned but they do not start a new group
				if (isProperty(prop) && prop[valueField(prop)] && !prop.shorthand && !prop.method) {
					groups.at(-1)!.push(prop);
				}

				prev = prop;
			}

			const quoteEveryKey = needsQuoteProps(properties, options);

			for (const group of groups.filter((group) => group.length > 1)) {
				const keyLengths = new Map<Node, number>(
					group.map((property) => [property, keyLength(property, options, quoteEveryKey)]),
				);
				const alignedLength = Math.max(...keyLengths.values());

				for (const property of group) {
					property[paddingSymbol] = alignedLength - keyLengths.get(property)!;
				}
			}
		}

		return getOriginalPrinter().print(path, options, _print, ...args);
	},
};

function isPropertyContainer(node: AstPath["node"]) {
	return (
		node.type === "ObjectExpression" ||
		node.type === "TSInterfaceBody" ||
		node.type === "TSTypeLiteral" ||
		node.type === "ClassBody"
	);
}

function nodeProperties(node: AstPath["node"]) {
	if (node.type === "ObjectExpression") {
		return node.properties;
	}
	if (node.type === "TSInterfaceBody" || node.type === "ClassBody") {
		return node.body;
	}
	if (node.type === "TSTypeLiteral") {
		return node.members;
	}
	throw new Error(`Unexpected node type: ${node.type}`);
}

function isProperty(node: AstPath["node"]) {
	// JS has ObjectProperty, TS has Property
	return (
		node.type === "Property" ||
		node.type === "TSPropertySignature" ||
		node.type === "ObjectProperty" ||
		node.type === "PropertyDefinition"
	);
}

function valueField(node: AstPath["node"]) {
	if (node.type === "Property" || node.type === "ObjectProperty") {
		return "value";
	}
	if (node.type === "TSPropertySignature" || node.type === "PropertyDefinition") {
		return "typeAnnotation";
	}
	throw new Error(`Unexpected node type: ${node.type}`);
}

/**
 * Widens the ":" separating the key from the value in the doc prettier printed for a property, which is the
 * only thing this plugin changes. Prettier trims the trailing spaces of a line, so the padding disappears by
 * itself when the value is moved below the ":".
 */
function addPaddingAfterColon(doc: Doc, padding: number): Doc {
	const spaces = " ".repeat(padding);

	// The separator is a part of its own in the doc of a property: `[key, ":", " ", value]` for an object
	// property, `[key, [": ", type]]` for an interface member, ...
	function patch(parts: Doc[]): Doc[] | undefined {
		for (const [index, part] of parts.entries()) {
			if (part === ":" || part === ": ") {
				const patched = [...parts];
				patched[index] = `:${spaces}${part.slice(1)}`;
				return patched;
			}
			if (Array.isArray(part)) {
				const patchedPart = patch(part);
				if (patchedPart) {
					const patched = [...parts];
					patched[index] = patchedPart;
					return patched;
				}
			}
		}
	}

	if (Array.isArray(doc)) {
		return patch(doc) ?? doc;
	}
	if (typeof doc === "object" && doc.type === "group" && Array.isArray(doc.contents)) {
		const patched = patch(doc.contents);
		return patched ? { ...doc, contents: patched } : doc;
	}
	return doc;
}

/**
 * The width of the key as prettier will print it: `quoteProps` can add or remove the quotes around it, and we
 * have to align on what is printed, not on what was written.
 */
function keyLength(property: Node, options: { quoteProps?: string }, quoteEveryKey: boolean) {
	const { key } = property;
	const modifiers = modifierLength(property);

	if (!property.computed) {
		if (isStringKey(key)) {
			if (!quoteEveryKey && options.quoteProps !== "preserve" && isIdentifierName(key.value)) {
				return key.value.length + modifiers;
			}
		} else if (quoteEveryKey && key.type === "Identifier") {
			return key.name.length + '""'.length + modifiers;
		}
	}

	return key.loc.end.column - key.loc.start.column + modifiers;
}

/** Prettier's `quoteProps: "consistent"`: one key needing quotes means every key is quoted. */
function needsQuoteProps(properties: Node[], options: { quoteProps?: string }) {
	return (
		options.quoteProps === "consistent" &&
		properties.some(
			(property) =>
				isProperty(property) && !property.computed && isStringKey(property.key) && !isIdentifierName(property.key.value),
		)
	);
}

function isStringKey(key: Node) {
	return key?.type === "StringLiteral" || (key?.type === "Literal" && typeof key.value === "string");
}

function isIdentifierName(value: string) {
	return /^(?:[$_\p{ID_Start}])(?:[$\u200C\u200D\p{ID_Continue}])*$/u.test(value);
}

function modifierLength(node: AstPath["node"]) {
	return (
		(node.optional ? "?".length : 0) +
		(node.computed ? "[]".length : 0) +
		(node.static ? "static ".length : 0) +
		(node.accessibility ? node.accessibility.length + 1 : 0) +
		(node.override ? "override ".length : 0) +
		(node.declare ? "declare ".length : 0) +
		(node.readonly ? "readonly ".length : 0)
	);
}

function nodeStart(node: Node): number {
	return node.range?.[0] ?? node.start;
}
function nodeEnd(node: Node): number {
	return node.range?.[1] ?? node.end;
}
function startWithComments(node: Node): number {
	return node.comments?.length ? Math.min(nodeStart(node), ...node.comments.map(nodeStart)) : nodeStart(node);
}
function endWithComments(node: Node): number {
	return node.comments?.length ? Math.max(nodeEnd(node), ...node.comments.map(nodeEnd)) : nodeEnd(node);
}

/**
 * Whether prettier prints this object-like node on several lines: it does so when there is a newline between
 * the "{" and the first member in the original text - comments on the "{" line do not count.
 */
function isExpanded(container: Node, members: Node[], options: { originalText: string }) {
	return members.length > 0 && options.originalText.slice(nodeStart(container), nodeStart(members[0])).includes("\n");
}

function hasBlankLineBetween(a: Node, b: Node, options: { originalText: string }) {
	const between = options.originalText.slice(endWithComments(a), startWithComments(b));
	return (between.match(/\n/g)?.length ?? 0) > 1;
}

/**
 * Whether this property is guaranteed to be printed on several lines, whatever the print width is.
 * Only *forced* breaks are taken into account: a break caused by the line being too long must not be
 * used to make layout decisions, otherwise the decision depends on the previous run's output.
 */
function forcesBreak(prop: Node, options: { originalText: string }): boolean {
	const value = isProperty(prop) ? prop[valueField(prop)] : prop;
	return value ? subtreeForcesBreak(value, options) : false;
}

const OBJECT_LIKE = new Set([
	"ObjectExpression",
	"ObjectPattern",
	"TSTypeLiteral",
	"TSInterfaceBody",
	"ClassBody",
	"RecordExpression",
]);

/**
 * Prettier always breaks an array of at least two object or array literals having more than one member.
 */
function isAlwaysBrokenArray(node: Node) {
	if (node.type !== "ArrayExpression" && node.type !== "TupleExpression") {
		return false;
	}

	return (
		node.elements.length > 1 &&
		node.elements.every(
			(element: Node) =>
				(element?.type === "ObjectExpression" && element.properties.length > 1) ||
				((element?.type === "ArrayExpression" || element?.type === "TupleExpression") && element.elements.length > 1),
		)
	);
}

/** A comment written on its own line stays on its own line, a trailing one does not break anything. */
function isOwnLineComment(comment: Node, options: { originalText: string }) {
	const before = options.originalText.slice(0, nodeStart(comment));
	return (
		/\n[^\S\n]*$/.test(before) ||
		options.originalText.slice(nodeStart(comment), nodeEnd(comment)).includes("\n")
	);
}

function subtreeForcesBreak(node: Node, options: { originalText: string }): boolean {
	if (!node || typeof node !== "object") {
		return false;
	}
	if (Array.isArray(node)) {
		return node.some((child) => subtreeForcesBreak(child, options));
	}
	if (!node.type) {
		return false;
	}
	if (node.comments?.some((comment: Node) => isOwnLineComment(comment, options))) {
		return true;
	}
	if (OBJECT_LIKE.has(node.type) && isExpanded(node, node.properties ?? node.body ?? node.members ?? [], options)) {
		return true;
	}
	if (isAlwaysBrokenArray(node)) {
		return true;
	}
	if (node.type === "BlockStatement" && node.body?.length) {
		return true;
	}
	// Only the literal parts of a template are kept as they are written: a newline anywhere else comes from a
	// nested node, which is checked on its own below.
	if (node.type === "TemplateLiteral" && node.quasis?.some((quasi: Node) => quasi.value?.raw?.includes("\n"))) {
		return true;
	}
	for (const key of Object.keys(node)) {
		if (key === "loc" || key === "range" || key === "parent" || key === "tokens") {
			continue;
		}
		if (subtreeForcesBreak(node[key], options)) {
			return true;
		}
	}
	return false;
}
