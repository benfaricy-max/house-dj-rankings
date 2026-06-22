import { Children } from "react";
import { useTier, TIER_META, startCheckout } from "./usePro";
import "./Paywall.css";

// Preview / freemium gating primitives. All of this is inert until the paywall
// flag is on (VITE_PAYWALL_ENABLED=true) — useTier() reports everything unlocked
// otherwise, so PreviewClip/LockGate render their children untouched. See COMMERCE.md.

function track(event, props) {
  try {
    window.plausible?.(event, { props });
    window.gtag?.("event", event, props);
  } catch { /* analytics optional */ }
}

// The upgrade card. Shows the surface's own tier as the primary CTA and, unless
// that tier already is All Access, offers All Access as the everything-bundle.
export function LockCard({ tier = "rankings", headline, sub, hiddenCount, source = "paywall" }) {
  const m = TIER_META[tier];
  const showAllAccess = tier !== "allaccess";
  const buy = (plan, label) => { track("upgrade_click", { plan, tier, source }); startCheckout(plan, { meta: { source } }); };
  return (
    <div className="pw-card" role="group" aria-label="Subscribe to unlock">
      <div className="pw-card-eyebrow">{m.name}</div>
      <h3 className="pw-card-h">{headline || "Subscribe to see the rest"}</h3>
      {sub && <p className="pw-card-sub">{sub}</p>}
      {hiddenCount > 0 && <div className="pw-card-count">{hiddenCount} more behind the subscription</div>}
      <div className="pw-card-actions">
        <button className="pw-btn pw-btn--primary" onClick={() => buy(m.plan, `${source}:${tier}`)}>
          Unlock {m.name} · {m.price}{m.cadence}
        </button>
        {showAllAccess && (
          <button className="pw-btn pw-btn--ghost" onClick={() => buy("allaccess", `${source}:allaccess`)}>
            Or All Access · {TIER_META.allaccess.price}{TIER_META.allaccess.cadence} — every paid feature
          </button>
        )}
      </div>
      <div className="pw-card-fine">Cancel anytime · secure checkout via Stripe</div>
    </div>
  );
}

// Renders the first `freeCount` children plainly, then — when locked — a blurred
// peek of the next few children behind the LockCard. The deep tail is not
// rendered at all (so a few hundred locked rows never hit the DOM). Returns its
// children as a fragment, so the free rows stay direct children of the parent
// (grid/flex layout is preserved). When unlocked, renders every child as-is.
export function PreviewClip({
  tier = "rankings",
  freeCount = 50,
  children,
  headline,
  sub,
  peek = 4,
  source = "preview",
}) {
  const { unlocked } = useTier(tier);
  const items = Children.toArray(children);
  if (unlocked || items.length <= freeCount) return <>{children}</>;

  const free = items.slice(0, freeCount);
  const teaser = items.slice(freeCount, freeCount + peek);
  const hidden = items.length - freeCount;
  return (
    <>
      {free}
      <div className="pw-clip">
        <div className="pw-clip-peek" aria-hidden="true">{teaser}</div>
        <div className="pw-clip-overlay">
          <LockCard tier={tier} headline={headline} sub={sub} hiddenCount={hidden} source={source} />
        </div>
      </div>
    </>
  );
}

// Whole-surface gate: renders an optional `preview` node, then the LockCard, in
// place of `children` when locked. Use where there's no ranked list to clip
// (e.g. a Booking Intelligence tool, the Deep Dive portal).
export function LockGate({ tier = "rankings", children, preview = null, headline, sub, source = "gate" }) {
  const { unlocked } = useTier(tier);
  if (unlocked) return <>{children}</>;
  return (
    <div className="pw-gate">
      {preview && <div className="pw-gate-preview" aria-hidden="true">{preview}</div>}
      <LockCard tier={tier} headline={headline} sub={sub} source={source} />
    </div>
  );
}

// Small "locked" lozenge for sub-tab labels.
export function LockPill() {
  return <span className="pw-pill" aria-label="locked">◆ Pro</span>;
}
