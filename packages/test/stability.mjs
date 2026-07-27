/**
 * Formatting must be idempotent: formatting an already formatted file must be a no-op.
 *
 * This is easy to break in this plugin, because it is tempting to base alignment decisions on the way the
 * input happens to be laid out (`node.loc`) - but the input is the output of the previous run, and the
 * padding we add changes prettier's line breaking decisions. Such a rule makes the formatting oscillate
 * between two states forever.
 */
import prettier from "prettier";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.join(packageDir, "..");
const failures = [];

async function checkStable(name, text, options) {
	const first = await prettier.format(text, options);
	const second = await prettier.format(first, options);

	if (first === second) {
		return;
	}

	const third = await prettier.format(second, options);
	const lines = first.split("\n");
	const otherLines = second.split("\n");
	const diff = [];

	for (
		let i = 0;
		i < Math.max(lines.length, otherLines.length) && diff.length < 6;
		i++
	) {
		if (lines[i] !== otherLines[i]) {
			diff.push(
				`  pass 1: ${JSON.stringify(lines[i])}\n  pass 2: ${JSON.stringify(otherLines[i])}`,
			);
		}
	}

	failures.push(
		`${name} is ${third === first ? "oscillating between two states" : "not idempotent"}:\n${diff.join("\n")}`,
	);
}

/**
 * The committed fixtures, formatted with the config of the package they live in.
 */
async function checkFixtures() {
	for (const pkg of ["test", "test-groups"]) {
		const dir = path.join(packagesDir, pkg, "src");
		for (const file of await readdir(dir)) {
			const filepath = path.join(dir, file);
			await checkStable(
				path.relative(packagesDir, filepath),
				await readFile(filepath, "utf8"),
				{
					...(await prettier.resolveConfig(filepath)),
					filepath,
				},
			);
		}
	}
}

// mulberry32, to keep the generated cases reproducible
let seed = 0x1234;
function random(max) {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return Math.floor((((t ^ (t >>> 14)) >>> 0) / 0x100000000) * max);
}
const pick = (values) => values[random(values.length)];
const name = (length) => "a".repeat(Math.max(1, length));

function randomValue(budget) {
	const b = Math.max(4, budget);
	switch (
		pick([
			"identifier",
			"call",
			"logical",
			"ternary",
			"string",
			"template",
			"member",
			"arrow",
			"await",
			"as",
			"binary",
			"object",
			"array",
			"unary",
			"new",
		])
	) {
		case "identifier":
			return name(b);
		case "call":
			return `fn${name(random(10))}(${name(random(b))}, ${name(random(10))})`;
		case "logical":
			return `${name(random(b))} && ${name(random(b))}`;
		case "ternary":
			return `${name(random(10))} ? ${name(random(b))} : ${name(random(b))}`;
		case "string":
			return `"${name(random(b))}"`;
		case "template":
			return `\`${name(random(b))}\${x}\``;
		case "member":
			return `${name(random(8))}.${name(random(8))}.${name(random(8))}(${name(random(8))})`;
		case "arrow":
			return `(${name(random(6))}) => ${name(random(b))}`;
		case "await":
			return `await ${name(random(8))}(${name(random(b))})`;
		case "as":
			return `${name(random(b))} as ${name(random(10))}`;
		case "binary":
			return `${name(random(b))} + ${name(random(b))}`;
		case "unary":
			return `!!${name(random(8))}.${name(random(b))}`;
		case "new":
			return `new ${name(random(8))}(${name(random(b))})`;
		case "array":
			return `[${name(random(b))}, ${name(random(10))}]`;
		case "object": {
			let object = "{\n";
			for (let i = 0; i < 2 + random(3); i++) {
				object += `\tk${name(random(14))}: ${randomValue(b - 20)},\n`;
			}
			return `${object}}`;
		}
	}
}

/**
 * Objects with random key lengths and values, at random indentation levels: some of them land exactly on the
 * print width limit, which is where the plugin used to oscillate.
 */
function randomObject() {
	let text = "const x = {\n";
	for (let i = 0; i < 2 + random(5); i++) {
		text += `\tk${name(random(18))}: ${randomValue(60 + random(50))},\n`;
	}
	text += "};\n";

	for (let depth = 0; depth < random(5); depth++) {
		text = `function f${depth}() {\n${text
			.split("\n")
			.map((line) => (line ? `\t${line}` : line))
			.join("\n")}}\n`;
	}

	return text;
}

async function checkGeneratedObjects() {
	for (const alignInGroups of ["never", "always"]) {
		seed = 0x1234;
		for (let i = 0; i < 400 && failures.length < 5; i++) {
			const text = randomObject();
			await checkStable(
				`generated object #${i} (alignInGroups: ${alignInGroups})\n${text}`,
				text,
				{
					parser:     "typescript",
					plugins:    ["@huggingface/prettier-plugin-vertical-align"],
					printWidth: 120,
					tabWidth:   2,
					useTabs:    true,
					alignInGroups,
				},
			);
		}
	}
}

await checkFixtures();
await checkGeneratedObjects();

if (failures.length) {
	console.error(`Formatting is not stable:\n\n${failures.join("\n\n")}`);
	process.exit(1);
}

console.log("Formatting is stable");
