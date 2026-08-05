import type { Printer } from "prettier";

let originalPrinter: Printer;

/// `wrapParser.preprocess` installs the plugin by replacing `options.printer` with a merged object
/// whose `print` is ours. Prettier runs `preprocess` more than once per format (range-format and
/// option-normalization both re-enter it); the second call would capture the already-installed plugin
/// printer as the "original", making `getOriginalPrinter().print` re-enter our own `print` for the
/// root node forever (RangeError: Maximum call stack size exceeded). The real printer is always the
/// first one prettier hands us, so keep it.
export function setOriginalPrinter(printer: Printer) {
  if (originalPrinter) {
    return;
  }
  originalPrinter = printer;
}

export function getOriginalPrinter() {
  if (!originalPrinter) {
    throw new Error("Original printer has not been set");
  }
  return originalPrinter;
}