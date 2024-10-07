const x = {
	a:  1,
	bc: {
		x: 1,
	},
};

const y = {
	a: 1,
};

interface X {
	a:   string;
	cb?: number;
}

const oneLine = { x: 1, yc: 2 };

type T = {
	x:  1;
	yc: 2; // Test
};

const s = "Hello, World!";

const withCompute = {
	[s]: 1,
	z:   2,
};

function diposable() {
	return {
		[Symbol.asyncDispose]: async () => {},
	};
}

async function test(...args: any[]) {
	await using x = diposable();
}

async function test2() {
	const x2 = {
		a:            1,
		abc:
			"abcedfghijkmnopqrstuvwxyz" ||
			"abcedfghijkmnopqrstuvwxyz" ||
			"abcedfghijkmnopqrstuvwxyz" ||
			"abcedfghijkmnopqrstuvwxyz",
		sameLine:     test(
			"abcedfghijkmnopqrstuvwxyz" ||
				"abcedfghijkmnopqrstuvwxyz" ||
				"abcedfghijkmnopqrstuvwxyz" ||
				"abcedfghijkmnopqrstuvwxyz",
		),
		sameLine2:    XClass.test(
			"abcedfghijkmnopqrstuvwxyz" ||
				"abcedfghijkmnopqrstuvwxyz" ||
				"abcedfghijkmnopqrstuvwxyz" ||
				"abcedfghijkmnopqrstuvwxyz",
		),
		sameAsync:    await test(
			"abcedfghijkmnopqrstuvwxyz" ||
				"abcedfghijkmnopqrstuvwxyz" ||
				"abcedfghijkmnopqrstuvwxyz" ||
				"abcedfghijkmnopqrstuvwxyz",
		),
		sameFuncDecl: (x: string) => {
			return (
				"abcedfghijkmnopqrstuvwxyz" ||
				"abcedfghijkmnopqrstuvwxyz" ||
				"abcedfghijkmnopqrstuvwxyz" ||
				"abcedfghijkmnopqrstuvwxyz"
			);
		},
		sameTemplate: `<p>Great news! ${"abcedfghijkmnopqrstuvwxyz"} blabla  ${
			"abcedfghijkmnopqrstuvwxyz" ||
			"abcedfghijkmnopqrstuvwxyz" ||
			"abcedfghijkmnopqrstuvwxyz"
		}.</p>`,
	};
}

const short = {
	x:  1,
	y,
	...y,
	test() {
		return 1;
	},
	zz: 1,
};

class Base {
	readonly fozobar?: 4;
}

class XClass extends Base {
	constructor() {
		super();
		this.boo = 1;
	}
	static test(...args: any[]) {}

	x?:                         1;
	abcedf?:                    1;
	private boo:                1;
	private readonly foobar?:   2;
	static readonly barfoo?:    3;
	override readonly fozobar?: 4 = 4;
	declare readonly foobar2?:  5;

	y = 1;
	// @ts-expect-error implicity-any
	z;
}
