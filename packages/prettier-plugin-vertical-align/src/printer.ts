import type { AstPath, Printer } from "prettier";
import prettier from "prettier";
// import { inspect } from "node:util";
const { doc } = prettier;
import { getOriginalPrinter } from "./original-printer.js";

const { group } = doc.builders;

type Node = AstPath["node"];
const keyLengthSymbol = Symbol("keyLength");
const typeAnnotationPrefix = Symbol("typeAnnotation");

export const printer: Printer = {
	print(path, options, _print, ...args) {
		// const originalPrinter = options.printer as Printer;

		const node = path.node;

		// if (node.comments) {
		// 	console.log("!!COMMENTS");
		// }

		// if (node.type === "Program") {
		// 	console.log("node", inspect(node.body, { depth: 10 }));
		// }

		if (node[keyLengthSymbol]) {
			const keyLength = node[keyLengthSymbol];
			const addedLength =
				keyLength -
				(node.key.loc.end.column - node.key.loc.start.column) -
				(node.optional ? 1 : 0) -
				(node.computed ? 2 : 0);

			// console.log("keyLength", keyLength);

			switch (node.type) {
				case "Property":
				case "ObjectProperty":
					return group([
						node.computed ? "[" : "",
						path.call(_print, "key"),
						node.computed ? "]" : "",
						":" + " ".repeat(addedLength + 1),
						path.call(_print, valueField(node)),
					]);
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
			// console.log("node", inspect(node, {depth: 10}));
			const properties: Node[] = nodeProperties(node)
				.filter(isProperty)
				.filter((node: Node) => node.key.loc.start.line === node.key.loc.end.line && !node.shorthand);

			// Check props are not on the same line (we don't want to add extra spaces in that case)
			if (properties.length > 1 && properties[1].loc.start.line !== properties[0].loc.start.line) {
				let keyLength = 0;
				for (const property of properties) {
					keyLength = Math.max(
						keyLength,
						property.key.loc.end.column -
							property.key.loc.start.column +
							(property.optional ? 1 : 0) +
							(property.computed ? 2 : 0),
					);
				}

				for (const property of properties) {
					property[keyLengthSymbol] = keyLength;
				}
			}
		}

		return getOriginalPrinter().print(path, options, _print, ...args);
	},
};

function isPropertyContainer(node: AstPath["node"]) {
	return node.type === "ObjectExpression" || node.type === "TSInterfaceBody" || node.type === "TSTypeLiteral";
}

function nodeProperties(node: AstPath["node"]) {
	if (node.type === "ObjectExpression") {
		return node.properties;
	}
	if (node.type === "TSInterfaceBody") {
		return node.body;
	}
	if (node.type === "TSTypeLiteral") {
		return node.members;
	}
	throw new Error(`Unexpected node type: ${node.type}`);
}

function isProperty(node: AstPath["node"]) {
	// JS has ObjectProperty, TS has Property
	return node.type === "Property" || node.type === "TSPropertySignature" || node.type === "ObjectProperty";
}

function valueField(node: AstPath["node"]) {
	if (node.type === "Property" || node.type === "ObjectProperty") {
		return "value";
	}
	if (node.type === "TSPropertySignature") {
		return "typeAnnotation";
	}
	throw new Error(`Unexpected node type: ${node.type}`);
}
