// QA (independent): static design-compliance audit of apps/web/src.
// Enforces the non-negotiable invariants from Design.md §2/§5.5 + CLAUDE.md §5.5:
// only the 8 palette tokens, no gradients/blur/blob/drop-shadow, no decorative
// raster/vector icons, no fabricated Google OAuth or daily-quota UI.
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "..", "..", "src");
const INDEX_HTML = join(import.meta.dir, "..", "..", "index.html");

const ALLOWED_HEX = new Set([
  "#F0EEE8",
  "#FAF9F5",
  "#282824",
  "#B77A45",
  "#77746B",
  "#DCD8CE",
  "#54836A",
  "#C45E52",
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const sources = files.map((f) => [f, readFileSync(f, "utf8")] as const);

function hexes(text: string): string[] {
  return (text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((h) => h.toUpperCase());
}

describe("QA design compliance: palette tokens", () => {
  test("only the 8 approved hex tokens appear in source", () => {
    const offenders: string[] = [];
    for (const [file, text] of sources) {
      for (const hex of hexes(text)) {
        if (!ALLOWED_HEX.has(hex)) offenders.push(`${file}: ${hex}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("no gradients, blur, backdrop-filter or blob decorations", () => {
    const offenders: string[] = [];
    for (const [file, text] of sources) {
      if (/gradient|backdrop-filter|\bblur\b|blob/i.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  test("only the command palette may use a floating shadow", () => {
    const offenders = sources
      .filter(([file, text]) => /\bshadow-/.test(text) && !file.endsWith("CommandPalette.tsx"))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });

  test("no decorative svg/img icons in components", () => {
    const offenders = sources
      .filter(([, text]) => /<svg|<img|\.svg|\.png/i.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});

describe("QA non-functional gaps that must NOT be fabricated", () => {
  test("no Google OAuth UI anywhere", () => {
    const offenders: string[] = [];
    for (const [file, text] of sources) {
      if (/google|oauth|\bgsi\b|sign in with/i.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  test("no daily-quota / bonus fabrication in the web client", () => {
    const offenders: string[] = [];
    for (const [file, text] of sources) {
      if (/kuota|quota|bonus harian|daily quota/i.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  test("index.html loads no third-party script beyond the app entry", () => {
    const html = readFileSync(INDEX_HTML, "utf8");
    const scripts = html.match(/<script[^>]*>/g) ?? [];
    expect(scripts.length).toBe(1);
    expect(scripts[0]).toContain("/src/main.tsx");
  });
});
