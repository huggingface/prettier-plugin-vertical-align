import type { Printer } from "prettier";

let originalPrinter: Printer;

export function setOriginalPrinter(printer: Printer) {
  originalPrinter = printer;
}

export function getOriginalPrinter() {
  if (!originalPrinter) {
    throw new Error("Original printer has not been set");
  }
  return originalPrinter;
}