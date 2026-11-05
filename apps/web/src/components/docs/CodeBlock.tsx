import { Fragment, useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyText } from "../../lib/format";

// Minimal token tinting for the dark code blocks (Design.md §2.2). A highlight
// library would drag in foreign colours, so only these three classes are used.
const TOKEN = /(#[^\n]*|\/\/[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b)/g;

function toneOf(token: string): string {
  if (token.startsWith("#") || token.startsWith("//")) return "text-secondary";
  if (token.startsWith('"') || token.startsWith("'")) return "text-accent";
  return "text-success";
}

export function CodeSyntax({ code }: { code: string }) {
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

export type CodeBlockProps = {
  code: string;
  language?: string;
  filename?: string;
  showCopy?: boolean;
  className?: string;
};

export function CodeBlock({
  code,
  language,
  filename,
  showCopy = true,
  className = "",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const showHeader = Boolean(language || filename || showCopy);

  return (
    <div
      className={`rounded-md border border-hairline overflow-hidden ${className}`}
      style={{ background: "var(--bg-terminal)" }}
    >
      {showHeader && (
        <div className="flex items-center justify-between border-b border-hairline px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--state-error)" }} />
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--state-warning)" }} />
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--state-success)" }} />
            {filename ? (
              <span className="font-mono text-[11px] text-secondary ml-1">{filename}</span>
            ) : language ? (
              <span className="font-mono text-[11px] uppercase tracking-wider text-secondary ml-1">
                {language}
              </span>
            ) : null}
          </div>
          {showCopy && (
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-secondary hover:text-primary transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-success" aria-hidden="true" />
                  <span className="text-success">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" aria-hidden="true" />
                  <span>Salin</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
      <pre
        className="overflow-x-auto p-3 font-mono text-[12px] leading-5"
        style={{ color: "var(--text-terminal)" }}
      >
        <CodeSyntax code={code} />
      </pre>
    </div>
  );
}
