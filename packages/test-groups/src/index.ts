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

	group3: "a",
	group4bbb: {
		x: 1,
	},
	group5: "b",
};
