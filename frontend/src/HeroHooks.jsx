/**
 * HeroHooks — a rotating call-out line at the top of the front page.
 *
 * One line, three audiences, each phrased as a specific personal call-out re-aimed
 * at the customers the index serves — promoters/festivals, agents/managers, and the
 * scene. Positive-sum framing only: none of them say "pay less" or "they're
 * overpriced" (the buy-side-squeeze line is radioactive and leaves the homepage).
 * It cycles so each audience sees themselves within a few seconds of landing —
 * without three competing headlines fighting for the same space.
 *
 * No new data, no dependency on App internals. Clicking the line takes that
 * audience to the tab that answers it, via the onSelect(tab) callback.
 */
import { useEffect, useState } from "react";

const HOOKS = [
  {
    who: "Promoters",
    line: "Find who's breaking before they break the bank.",
    tab: "booking",
  },
  {
    who: "Agents",
    line: "Proof your act is in demand — before the conversation about fees.",
    tab: "booking",
  },
  {
    who: "The scene",
    line: "Who's actually hot right now. Daily.",
    tab: "rankings",
  },
];

const ROTATE_MS = 4200;

export default function HeroHooks({ onSelect }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const t = setInterval(() => setI((n) => (n + 1) % HOOKS.length), ROTATE_MS);
      return () => clearInterval(t);
    }
    const t = setInterval(() => {
      setShown(false);
      setTimeout(() => {
        setI((n) => (n + 1) % HOOKS.length);
        setShown(true);
      }, 320);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  const h = HOOKS[i];

  return (
    <button
      type="button"
      onClick={() => onSelect?.(h.tab)}
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: "0 auto 4px",
        maxWidth: 620,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "4px 8px",
        fontFamily: "'IBM Plex Mono', monospace",
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(4px)",
        transition: "opacity .32s ease, transform .32s ease",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#0c0c0e",
          background: "#C8F750",
          borderRadius: 999,
          padding: "3px 9px",
        }}
      >
        {h.who}
      </span>
      <span
        style={{
          fontSize: 14,
          lineHeight: 1.45,
          color: "#e9e8e2",
          textAlign: "left",
        }}
      >
        {h.line}
      </span>
    </button>
  );
}
