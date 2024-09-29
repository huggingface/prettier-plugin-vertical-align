import type { Printer } from "prettier";

export const printer: Printer = {
	print(path, options, _print) {
		console.log("path", path);
		return _print(path);
	},
};
