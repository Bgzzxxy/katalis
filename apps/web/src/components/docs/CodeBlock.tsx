import { Fragment } from "react";

// Minimal token tinting for the dark code blocks (Design.md §2.2). A highlight
// library would drag in foreign colours, so only these three classes are used.
const TOKEN = /(#[^\n]*|\/\/[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b)/g;

function toneOf(token: string): string {
  if (token.startsWith("#") || token.startsWith("//")) return "text-secondary";
  if (token.startsWith('"') || token.startsWith("'")) return "text-accent";
  return "text-success";
}

export function CodeBlock({ code }: { code: string }) {
  const parts = code.split(TOKEN);
  return (
    <code>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className={toneOf(part)}>
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </code>
  );
}
