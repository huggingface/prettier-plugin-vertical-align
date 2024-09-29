# prettier-plugin-vertical-align
Bringing old school cool to prettier

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
