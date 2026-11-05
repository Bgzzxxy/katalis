import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// IMPORTANT: import this module FIRST in every web test file, before importing
// @testing-library/react. ES imports hoist, so RTL captures document.body at
// module-eval time; the DOM must already exist by then. Registration is a
// top-level side effect here for exactly that reason.
if (!(globalThis as unknown as { document?: unknown }).document) {
  GlobalRegistrator.register({ url: "http://localhost:5173" });
}

/**
 * Call once at the top of each test file (after `import "./setup"`). Registers
 * per-file RTL cleanup. Bun attributes hooks registered inside an imported
 * module to the first importer only, so this must run from the test file's own
 * context.
 */
export function setupDom() {
  afterEach(async () => {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  });
}