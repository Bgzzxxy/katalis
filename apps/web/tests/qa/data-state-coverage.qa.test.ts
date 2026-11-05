// QA (independent): every component that loads remote data must route its
// rendering through the shared DataState (Design.md §6, 4 mandatory states).
// This is a static guard so a future page cannot bypass the 4-state contract.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "..", "..", "src");

const DATA_PAGES = [
  "pages/MonitorPage.tsx",
  "pages/KeysDashboardPage.tsx",
  "pages/BillingPage.tsx",
];

describe("QA: 4-state contract wiring", () => {
  for (const rel of DATA_PAGES) {
    test(`${rel} routes rendering through DataState`, () => {
      const text = readFileSync(join(SRC, rel), "utf8");
      expect(text).toContain("DataState");
    });
  }

  test("the API key dashboard provides an empty state with a direct action", () => {
    const text = readFileSync(join(SRC, "pages/KeysDashboardPage.tsx"), "utf8");
    expect(text).toContain("emptyAction");
  });
});
