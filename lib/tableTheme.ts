// Reusable class-string recipes for the premium felt/gold table aesthetic
// (see the `.table-theme` CSS custom properties in app/globals.css). Kept
// here so the same gradient/shadow/glass recipe isn't hand-copied across
// GameTable, PlayerSeat, BidPanel, CommsDock, etc.

/** The table's felt playing surface — radial gradient + vignette + wood rail. */
export const FELT_SURFACE =
  "bg-[radial-gradient(ellipse_at_center,var(--felt)_0%,var(--felt-deep)_70%,var(--wood)_100%)] " +
  "shadow-[inset_0_0_120px_40px_rgba(0,0,0,0.55)] ring-1 ring-[var(--wood)]";

/** A soft gold ambient glow, e.g. behind the trump display. */
export const AMBIENT_GOLD_GLOW =
  "bg-[radial-gradient(circle,var(--ambient-glow)_0%,transparent_70%)]";

/** Glassmorphism panel base — HUD bars, bid panel, comms dock, modals on the table. */
export const GLASS_PANEL = "border border-white/10 bg-black/30 backdrop-blur-xl shadow-2xl";

/** Gold accent border + soft glow, e.g. trump highlight / active-bid emphasis. */
export const GOLD_GLOW = "border-[var(--gold)]/50 shadow-[0_0_20px_var(--gold-soft)]";

export const GOLD_TEXT = "text-[var(--gold)]";
