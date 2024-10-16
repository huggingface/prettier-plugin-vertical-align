import type { AstPath, Printer } from "prettier";
import prettier from "prettier";
// import { inspect } from "node:util";
const { doc } = prettier;
import { getOriginalPrinter } from "./original-printer.js";

const { group, softline, line, ifBreak, indent } = doc.builders;

type Node = AstPath["node"];
const keyLengthSymbol = Symbol("keyLength");
const typeAnnotationPrefix = Symbol("typeAnnotation");

function shouldMoveCompletelyToNextLine(node: Node) {
	return node.type === "LogicalExpression";

	// Alternative implementation:
	// return node.value.type !== "ObjectExpression" &&
	//   node.value.type !== "ArrayExpression" &&
	//   node.value.type !== "CallExpression" &&
	//   node.value.type !== "AwaitExpression";
}

export const printer: Printer = {
	print(path, options, _print, ...args) {
		// const originalPrinter = options.printer as Printer;

		const node = path.node;

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
						shouldMoveCompletelyToNextLine(node[valueField(node)])
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
			let prevLine = -Infinity;

			// console.log("node", node);
			// console.log("node", inspect(node, {depth: 10}));
			const properties: Node[] = nodeProperties(node).filter((node: Node) =>
				!isProperty(node) || !node[valueField(node)]?.loc
					? node.loc.start.line === node.loc.end.line
					: node.key.loc.start.line === node[valueField(node)].loc.start.line,
			);

			for (const prop of properties) {
				const propStart = prop.comments ? prop.comments[0].loc.start.line : prop.loc.start.line;
				if (prevLine === propStart) {
					// Multiple properties on the same line
					return getOriginalPrinter().print(path, options, _print, ...args);
				}
				if (prevLine === -Infinity || (options.alignInGroups === "always" && prevLine !== propStart - 1)) {
					groups.push([]);
				}

				// Shorthands and methods are not aligned but they do not start a new group
				if (isProperty(prop) && prop[valueField(prop)] && !prop.shorthand && !prop.method) {
					groups.at(-1)!.push(prop);
				}

				prevLine = prop.loc.start.line;
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
