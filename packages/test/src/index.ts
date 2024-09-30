const x = {
	a:  1,
	bc: {
		x: 1,
	},
};

const y = {
	a: 1,
};

const short = {
	x: 1,
	y,
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

const x2 = {
	a:         1,
	abc:
		"abcedfghijkmnopqrstuvwxyz" ||
		"abcedfghijkmnopqrstuvwxyz" ||
		"abcedfghijkmnopqrstuvwxyz" ||
		"abcedfghijkmnopqrstuvwxyz",
	sameLine:  test(
		"abcedfghijkmnopqrstuvwxyz" ||
			"abcedfghijkmnopqrstuvwxyz" ||
			"abcedfghijkmnopqrstuvwxyz" ||
			"abcedfghijkmnopqrstuvwxyz",
	),
	sameLine2: X.test(
		"abcedfghijkmnopqrstuvwxyz" ||
			"abcedfghijkmnopqrstuvwxyz" ||
			"abcedfghijkmnopqrstuvwxyz" ||
			"abcedfghijkmnopqrstuvwxyz",
	),
};
