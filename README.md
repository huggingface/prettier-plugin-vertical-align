# prettier-plugin-vertical-align

Align object properties and interface members vertically for JS/TS code.

## Example

```typescript
// input
const a = {
  x: 1,
  bcd: 2,
}

interface Foo {
  x: number
  bcd: number
}
```

becomes

```typescript
// output
const a = {
  x:   1,
  bcd: 2,
};

interface Foo {
  x:   number;
  bcd: number;
}
```

## Formatting

Everything is printed by prettier: the plugin only widens the `:` separating a key from its value, so a line
that has no space to add - an object whose keys all have the same length, for instance - is formatted exactly
like prettier would. Formatting is idempotent: running the plugin on an already formatted file never changes
it again.

## Installation

Add `plugins: ["@huggingface/prettier-plugin-vertical-align"]` to your `.prettierrc` file.

## Configuration

### alignInGroups

Aligns properties in groups. Default is `"never"`. You can set it to `"always"` to always align properties in groups in your `.prettierrc`.

```json
{
  "alignInGroups": "always"
}
```

If enabled, it will create groups inside an object, based on blank lines or multiline values. For example:

```typescript
const x = {
	group1:  "a",
	group1b: "b",

	group2:     "a",
	// some comment between two lines
	group2bbbb: "b",

	group3:   "a",
	group3bb: {
		x: 1,
	},
	group4: "b", // new group due to multiline value above
};
```

Only values that are always printed on several lines start a new group (an object written over several lines, a function body, a multiline template literal, ...). A value that ends up on several lines only because the line is too long keeps its group: whether it fits depends on the padding that was just added, so using it would make the formatting oscillate between two states on every run.
