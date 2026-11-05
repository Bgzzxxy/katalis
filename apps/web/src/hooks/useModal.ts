import { useEffect, useRef } from "react";

/**
 * Shared dialog behaviour (Design.md §5.4/§5.5): Escape closes, focus moves into
 * the dialog on open and is restored to the trigger on close.
 */
export function useModal<T extends HTMLElement>(onClose: () => void, active = true) {
  const ref = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const restore = document.activeElement as HTMLElement | null;
    const container = ref.current;
    // Respect an element already focused inside (e.g. React `autoFocus`).
    const alreadyFocused = container?.contains(document.activeElement) ?? false;
    if (!alreadyFocused) {
      const focusable = container?.querySelector<HTMLElement>(
        "input,select,textarea,button,[href],[tabindex]:not([tabindex='-1'])",
      );
      (focusable ?? container)?.focus();
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !container) return;
      const items = Array.from(
        container.querySelectorAll<HTMLElement>(
          "input,select,textarea,button,[href],[tabindex]:not([tabindex='-1'])",
        ),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restore?.focus?.();
    };
  }, [active]);

  return ref;
}
