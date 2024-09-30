const x = {
	a:  1,
	bc: 2,
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

async function test() {
	await using x = diposable();
}
