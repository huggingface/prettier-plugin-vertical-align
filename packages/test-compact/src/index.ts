declare const foo: any;
declare const bar: any;
declare const longBar: any;
declare const baz: any;

// Consecutive matching calls — arguments vertically aligned
foo.method(baz,     bar);
foo.method(longBar, bar);

// Blank line separates groups (alignInGroups: "always")
foo.mthd("short",      bar);
foo.mthd("muchlonger", bar);

// Non-matching expression — formatted normally with property alignment
const x = {
	a:  1,
	bc: {
		x: 1,
	},
};

// Another group of aligned calls
console.log("short",      "world", 1);
console.log("muchlonger", "world", 2);
console.log("x",          "world", 3);

// Three-arg alignment
foo.method("short",      baz,     bar);
foo.method("muchlonger", longBar, bar);

// Different callee widths — padding after ( aligns all arguments
foo.mthd      ("short", baz, bar);
foo.longMethod("short", baz, bar);

// Complex args with nested object
foo.method([
	"superreallylong",
	"short",
	"x",
],           baz.biz({ foo: [] }));
foo.method([
	"short",
	"muchlonger",
],           baz.biz({ bar }));

// Array first arg — array stays multi-line, remaining args aligned
foo.method([
	"short",
	"short",
],                  bar);
foo.method("short", bar);
