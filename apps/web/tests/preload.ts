import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Shared preload for the whole monorepo (see bunfig.toml). Registers a DOM
// once per worker so @testing-library/react can capture document.body at
// module-eval time (import order alone is not enough: Bun may evaluate RTL's
// CJS screen.js before a test file's own side effects).
//
// Happy DOM also replaces the Web Fetch API globals, which breaks the API test
// suite: Hono's Set-Cookie / httpOnly session flow and Bun.serve + undici fetch
// abort handling rely on the native primitives ("signal is not of type
// AbortSignal"). Preserve the native fetch primitives so both suites can share
// one preload; only DOM-related globals stay Happy DOM's.
const FETCH_GLOBALS = [
  "Headers",
  "Request",
  "Response",
  "fetch",
  "AbortController",
  "AbortSignal",
  "ReadableStream",
  "WritableStream",
  "TransformStream",
  "TextEncoder",
  "TextDecoder",
  "Blob",
  "File",
  "FormData",
] as const;

type NativeGlobals = Partial<Record<(typeof FETCH_GLOBALS)[number], unknown>>;

const nativeGlobals: NativeGlobals = {};
for (const name of FETCH_GLOBALS) {
  nativeGlobals[name] = (globalThis as Record<string, unknown>)[name];
}

if (!(globalThis as unknown as { document?: unknown }).document) {
  GlobalRegistrator.register({ url: "http://localhost:5173" });
  for (const name of FETCH_GLOBALS) {
    Object.defineProperty(globalThis, name, {
      value: nativeGlobals[name],
      writable: true,
      configurable: true,
    });
  }
}
