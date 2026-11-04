// Test preload (registered in bunfig.toml). Bun already loads .env.test when
// NODE_ENV=test; this file is intentionally minimal and only guards the test
// environment assumption so failures are explicit rather than silent.
if (process.env.NODE_ENV !== "test") {
  throw new Error(`Expected NODE_ENV=test, got ${process.env.NODE_ENV}`);
}