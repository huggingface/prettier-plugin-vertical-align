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
// when set, every generated key has exactly this length, whatever the nesting level
let fixedKeyLength = 0;
const key = (index) =>
	`${name(fixedKeyLength ? fixedKeyLength - 1 : 1 + random(14))}k${index}`;
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
				object += `\t${key(i)}: ${randomValue(b - 20)},\n`;
			}
			return `${object}}`;
		}
	}
}

/**
 * Objects with random key lengths and values, at random indentation levels: some of them land exactly on the
 * print width limit, which is where the plugin used to oscillate.
 */
function randomObject(keyLength = 0) {
	fixedKeyLength = keyLength;
	let text = "const x = {\n";
	for (let i = 0; i < 2 + random(5); i++) {
		text += `\t${key(i)}: ${randomValue(60 + random(50))},\n`;
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

/**
 * When every key of an object has the same length, we have no space to add anywhere: the output must then be
 * exactly the one of prettier. More generally, a property that needs no padding is printed by prettier
 * itself, so that we only ever change the lines we have something to add to.
 */
async function checkGeneratedObjectsMatchPrettier() {
	seed = 0x5678;
	for (let i = 0; i < 400 && failures.length < 5; i++) {
		const text = randomObject(3 + random(18));
		const options = {
			parser:     "typescript",
			printWidth: 120,
			tabWidth:   2,
			useTabs:    true,
		};
		const expected = await prettier.format(text, options);
		const actual = await prettier.format(text, {
			...options,
			plugins: ["@huggingface/prettier-plugin-vertical-align"],
		});

		if (expected !== actual) {
			failures.push(
				`generated object #${i} has keys of the same length but is not formatted like prettier:\n${text}\n--- prettier ---\n${expected}--- with the plugin ---\n${actual}`,
			);
		}
	}
}

/**
 * Sources whose keys are not printed the way they are written: `quoteProps` adds or removes the quotes, so
 * the padding has to be computed on the printed key, otherwise the file changes again on the next run.
 */
async function checkQuotedKeys() {
	const cases = [
		// prettier removes the quotes it does not need
		{ source: `const x = {\n\t"aaa": 1,\n\t"b": 2,\n};\n`, options: {} },
		// one key needs quotes, so prettier quotes all of them
		{
			source:  `const x = {\n\t"a-b": 1,\n\taaa: 2,\n\tb: 3,\n};\n`,
			options: { quoteProps: "consistent" },
		},
		// the quotes are kept as they are written
		{
			source:  `const x = {\n\t"aaa": 1,\n\tb: 2,\n};\n`,
			options: { quoteProps: "preserve" },
		},
	];

	for (const [index, { source, options }] of cases.entries()) {
		await checkStable(`quoted keys #${index}\n${source}`, source, {
			parser:     "typescript",
			plugins:    ["@huggingface/prettier-plugin-vertical-align"],
			printWidth: 120,
			tabWidth:   2,
			useTabs:    true,
			...options,
		});
	}
}

/**
 * Group boundaries must only depend on breaks that always happen, whatever the print width is.
 */
async function checkGroupBoundaries() {
	const cases = [
		// a comment on the "{" line does not prevent prettier from expanding the object
		`const x = { // hello\n\taa: 1, bbbbbb: 2 };\n`,
		// an inline comment does not make the value multiline
		`const x = {\n\taa: /* cast */ value,\n\tbbbbbb: 3,\n\tcc: 4,\n};\n`,
		// neither does a trailing one
		`const x = {\n\taa: 1, // note\n\tbbbbbb: 3,\n\tcc: 4,\n};\n`,
		// prettier collapses this array, so it stays in the group
		`const x = {\n\taa: [\n\t\t1,\n\t\t2,\n\t],\n\tbbbbbb: 3,\n\tcc: 4,\n};\n`,
		// but it always breaks an array of objects, so it ends the group
		`const x = {\n\taa: [{ a: 1, b: 2 }, { a: 3, b: 4 }],\n\tbbbbbb: 3,\n\tcc: 4,\n};\n`,
		// a break inside a template interpolation is not a break of the property
		`const x = {\n\tk: \`text \${fn(argumentOne, argumentTwo, argumentThree, argFour)} tail\`,\n\tkkkkkkkkkkkk: 1,\n\tkkk: 2,\n};\n`,
	];

	for (const [index, source] of cases.entries()) {
		for (const alignInGroups of ["never", "always"]) {
			await checkStable(
				`group boundaries #${index} (alignInGroups: ${alignInGroups})\n${source}`,
				source,
				{
					parser:     "typescript",
					plugins:    ["@huggingface/prettier-plugin-vertical-align"],
					printWidth: 80,
					tabWidth:   2,
					useTabs:    true,
					alignInGroups,
				},
			);
		}
	}
}

/**
 * Every kind of member must actually end up aligned: a padding we compute but fail to print is invisible in
 * the fixtures as long as the member with the longest key is the one prettier prints unchanged.
 */
async function checkColumnsAreAligned() {
	const cases = [
		`const object = {\n\ta: 1,\n\tbbbbbb: 2,\n\tcc: 3,\n};\n`,
		`const quoted = {\n\t"a-b": 1,\n\tbbbbbb: 2,\n\tcc: 3,\n};\n`,
		`const computed = {\n\t[a]: 1,\n\tbbbbbb: 2,\n\tcc: 3,\n};\n`,
		`interface Members {\n\ta: Foo;\n\tbbbbbb?: number;\n\tcc: number;\n}\n`,
		`type Literal = {\n\ta: Foo;\n\tbbbbbb: number;\n\tcc: number;\n};\n`,
		`class Fields {\n\ta: Foo;\n\tbbbbbb: number;\n\tcc: number;\n}\n`,
		`class Initializers {\n\ta: Foo = 1;\n\tbbbbbb: number = 3;\n\tcc: number = 4;\n}\n`,
		`class Modifiers {\n\tprivate a: Foo = 1;\n\tstatic readonly bbbbbb: number = 3;\n\tdeclare cc?: number;\n}\n`,
	];

	for (const source of cases) {
		const formatted = await prettier.format(source, {
			parser:     "typescript",
			plugins:    ["@huggingface/prettier-plugin-vertical-align"],
			printWidth: 120,
			tabWidth:   2,
			useTabs:    true,
		});

		// Every member of these sources is on a line of its own, at the same indentation, so all their values
		// have to start at the same column
		const columns = new Set();
		for (const line of formatted.split("\n")) {
			const member = /^\t+(?<key>.*?):(?<spaces> +)(?<value>\S.*)$/u.exec(line);
			if (member) {
				columns.add(line.length - member.groups.value.length);
			}
		}

		if (columns.size > 1) {
			failures.push(
				`the members of this source are not aligned:\n${source}\n--- formatted ---\n${formatted}`,
			);
		}
	}
}

/**
 * Range-formatting (`rangeStart`/`rangeEnd`) must not crash. Prettier runs `preprocess` more than
 * once for a range format, and a second `setOriginalPrinter` call used to capture the plugin's own
 * printer, making `getOriginalPrinter().print` re-enter the plugin's `print` for the root node until
 * the stack overflowed. The formatted output of a range covering the whole file must equal the
 * full-file output.
 */
async function checkRangeFormatting() {
	const sources = [
		`const object = {\n\ta: 1,\n\tbbbbbb: 2,\n\tcc: 3,\n};\n`,
		`interface X {\n\ta:  string;\n\tbc: number;\n}\n`,
		`const x = {\n\ta:  1,\n\tbc: {\n\t\tx: 1,\n\t},\n};\n`,
	];
	for (const [index, source] of sources.entries()) {
		for (const alignInGroups of ["never", "always"]) {
			const options = {
				parser:     "typescript",
				plugins:    ["@huggingface/prettier-plugin-vertical-align"],
				printWidth: 120,
				tabWidth:   2,
				useTabs:    true,
				alignInGroups,
			};
			let full;
			try {
				full = await prettier.format(source, options);
			} catch (err) {
				failures.push(
					`range #${index} full-file format threw: ${err.message}\n${source}`,
				);
				continue;
			}
			// range covering the whole file, a prefix, and a suffix
			for (const [range, [start, end]] of [
				["full", [0, source.length]],
				["prefix", [0, 10]],
				["suffix", [Math.max(0, source.length - 5), source.length]],
			]) {
				let rangeOut;
				try {
					rangeOut = await prettier.format(source, {
						...options,
						rangeStart: start,
						rangeEnd:   end,
					});
				} catch (err) {
					failures.push(
						`range #${index} (${range}, alignInGroups: ${alignInGroups}) threw: ${err.message}\n${source}`,
					);
					continue;
				}
				if (rangeOut !== full) {
					failures.push(
						`range #${index} (${range}, alignInGroups: ${alignInGroups}) differs from full-file output:\n${source}\n--- full ---\n${full}--- range ---\n${rangeOut}`,
					);
				}
			}
		}
	}
}

await checkFixtures();
await checkColumnsAreAligned();
await checkQuotedKeys();
await checkGroupBoundaries();
await checkGeneratedObjects();
await checkGeneratedObjectsMatchPrettier();
await checkRangeFormatting();

if (failures.length) {
	console.error(`${failures.join("\n\n")}`);
	process.exit(1);
}

console.log("Formatting is stable");
