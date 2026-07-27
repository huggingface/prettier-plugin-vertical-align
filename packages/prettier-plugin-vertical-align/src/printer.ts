import type { AstPath, Printer } from "prettier";
import prettier from "prettier";
// import { inspect } from "node:util";
const { doc } = prettier;
import { getOriginalPrinter } from "./original-printer.js";

const { group, softline, line, ifBreak, indent } = doc.builders;

type Node = AstPath["node"];
const keyLengthSymbol = Symbol("keyLength");
const typeAnnotationPrefix = Symbol("typeAnnotation");

/**
 * Mirrors prettier's own `shouldBreakAfterOperator` (src/language-js/print/assignment.js): those are the
 * values that prettier moves to the line below the `:` when the property does not fit.
 *
 * It must only depend on the AST and on the options, never on how the value happens to be laid out in the
 * input, otherwise formatting is not idempotent.
 */
function shouldMoveCompletelyToNextLine(value: Node, keyLength: number, options: { tabWidth: number }): boolean {
	if (!value) {
		return false;
	}

	if (isBinaryish(value) && !shouldInlineLogicalExpression(value)) {
		return true;
	}

	switch (value.type) {
		case "StringLiteralTypeAnnotation":
		case "SequenceExpression":
			return true;
		case "TSConditionalType":
		case "ConditionalExpression": {
			const { test } = value;
			return isBinaryish(test) && !shouldInlineLogicalExpression(test);
		}
		case "ClassExpression":
			return !!value.decorators?.length;
	}

	// Prettier keeps the value on the same line when the key is short
	if (keyLength <= options.tabWidth) {
		return false;
	}

	let node = value;
	while (node.type === "UnaryExpression" || node.type === "TSNonNullExpression") {
		node = node.argument ?? node.expression;
	}

	return isStringLiteral(node) || isMemberExpressionChain(node);
}

function isBinaryish(node: Node) {
	return node?.type === "BinaryExpression" || node?.type === "LogicalExpression";
}

function shouldInlineLogicalExpression(node: Node) {
	if (node.type !== "LogicalExpression") {
		return false;
	}
	if (node.right.type === "ObjectExpression" && node.right.properties.length > 0) {
		return true;
	}
	if (node.right.type === "ArrayExpression" && node.right.elements.length > 0) {
		return true;
	}
	return false;
}

function isStringLiteral(node: Node) {
	return node?.type === "StringLiteral" || (node?.type === "Literal" && typeof node.value === "string");
}

function isMemberExpressionChain(node: Node): boolean {
	if (node?.type !== "MemberExpression" && node?.type !== "OptionalMemberExpression") {
		return false;
	}
	if (node.object.type === "Identifier") {
		return true;
	}
	return isMemberExpressionChain(node.object);
}

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

		if (node[keyLengthSymbol]) {
			const keyLength = node[keyLengthSymbol];
			const addedLength = keyLength - (node.key.loc.end.column - node.key.loc.start.column) - modifierLength(node);

			// console.log("keyLength", keyLength);

			switch (node.type) {
				case "Property":
				case "ObjectProperty": {
					// console.log(node.value.type);
					return group([
						node.computed ? "[" : "",
						path.call(_print, "key"),
						node.computed ? "]" : "",
						":" + " ".repeat(addedLength + 1),
						shouldMoveCompletelyToNextLine(node[valueField(node)], keyLength, options)
							? ifBreak(indent(group([line, path.call(_print, valueField(node))])), path.call(_print, valueField(node)))
							: path.call(_print, valueField(node)),
					]);
				}
				case "PropertyDefinition":
				case "TSPropertySignature":
					node.typeAnnotation[typeAnnotationPrefix] = addedLength;
					return getOriginalPrinter().print(path, options, _print, ...args);
				default:
					throw new Error(`Unexpected node type: ${node.type}`);
			}
		}

		if (node[typeAnnotationPrefix]) {
			const addedLength = node[typeAnnotationPrefix];
			return group([": " + " ".repeat(addedLength), path.call(_print, "typeAnnotation")]);
		}

		if (isPropertyContainer(node)) {
			let groups: Node[][] = [];

			// console.log("node", node);
			// console.log("node", inspect(node, {depth: 10}));
			const properties: Node[] = nodeProperties(node);

			// The container is only aligned if it is printed on multiple lines. Prettier decides that from the
			// presence of a newline between the "{" and the first member in the *original* text, so this
			// predicate is stable under re-formatting.
			if (properties.length && !hasNewlineBeforeFirstMember(node, properties[0], options)) {
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

			for (const group of groups.filter((group) => group.length > 1)) {
				let keyLength = 0;
				for (const property of group) {
					keyLength = Math.max(
						keyLength,
						property.key.loc.end.column - property.key.loc.start.column + modifierLength(property),
					);
				}

				for (const property of group) {
					property[keyLengthSymbol] = keyLength;
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

function hasNewlineBeforeFirstMember(container: Node, firstMember: Node, options: { originalText: string }) {
	return options.originalText
		.slice(nodeStart(container), startWithComments(firstMember))
		.includes("\n");
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
	if (node.comments?.length) {
		return true;
	}
	if (OBJECT_LIKE.has(node.type)) {
		const members = node.properties ?? node.body ?? node.members ?? [];
		if (members.length && hasNewlineBeforeFirstMember(node, members[0], options)) {
			return true;
		}
	}
	if (node.type === "BlockStatement" && node.body?.length) {
		return true;
	}
	if (node.type === "TemplateLiteral" && options.originalText.slice(nodeStart(node), nodeEnd(node)).includes("\n")) {
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
