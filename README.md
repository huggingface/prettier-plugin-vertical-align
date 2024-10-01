# prettier-plugin-vertical-align

Aligns object properties and interface members vertically for JS/TS code.

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

	group3:    "a",
	group3bis: {
		x: 1,
	},
	group4: "b", // new group due to multiline value in group3bis
};
```