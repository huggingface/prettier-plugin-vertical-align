const y = 1;
const y2 = { props: {} };

const x = {
	group1:  "a",
	y,
	...y2.props,
	group1b: "b",

	group2:     "a",
	// some comment
	group2bbbb: "b",

	group3:    "a",
	group3bbb: {
		x: 1,
	},
	group4: "b",
};

// A value that is only broken over several lines because the line is too long does not start a new group:
// it would fit again as soon as the group is narrower, and the formatting would oscillate.
declare function isSet(value: unknown): boolean;
declare const o: Record<string, any>;

const widthBreakKeepsTheGroup = {
	repository: isSet(o.repository)
		? Repository.fromJSON(o.repository)
		: undefined,
	paths:      Array.isArray(o?.paths)
		? o.paths.map((e: any) => Buffer.from(e))
		: [],
	limit:      isSet(o.limit) ? Number(o.limit) : 0,
};
