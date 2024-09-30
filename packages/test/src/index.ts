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

class X {
	static test(...args: any[]) {}
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
		sameLine2:    X.test(
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
	x: 1,
	y,
	test() {
		return 1;
	},
};
