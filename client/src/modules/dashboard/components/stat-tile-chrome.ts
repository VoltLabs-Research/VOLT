/**
 * The chrome for a bento stat tile, shared by DashboardOverviewCard and
 * DashboardActivityTile.
 *
 * It was `DashboardOverviewCard.css`, which the activity tile borrowed by reusing
 * its class names. The sheet is gone, so the class strings live here rather than
 * being duplicated at both call sites — the two tiles must stay pixel-identical,
 * which is the whole reason the activity tile reached for the other component's
 * sheet in the first place.
 *
 * Why the group is NAMED: the sheet drove five child reveals off
 * `.dashboard-stat-card:hover`, and the chevron additionally brightens on the
 * inner button's own `:focus-visible`. One unnamed `group` cannot tell the two
 * ancestors apart, so the tile is `group/card` and the button `group/statbtn`.
 */

/**
 * `.dashboard-stat-card` plus its two column-span breakpoints.
 *
 * The hover `border-color: var(--color-border)` is deliberately not carried over:
 * it and the base's `--color-border-soft` both resolve to `--border` now
 * (spec §3a), so the declaration had nothing left to change.
 */
export const STAT_CARD = 'group/card col-span-3 p-0 min-h-[130px] transition-[background-color,border-color] duration-200 ease-[ease] hover:bg-surface-tertiary max-[1200px]:col-span-6 max-[768px]:col-span-12';

export const STAT_CARD_BUTTON = 'group/statbtn relative h-full w-full cursor-pointer border-none bg-transparent p-4 text-left focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--border),inset_0_0_0_3px_var(--focus)]';

/**
 * bravais's `IconFrame size='md'`: a 40px square at `--radius-md` (12px →
 * `rounded-xl`) with a 1px soft border and, for the default neutral tone, no fill
 * at all. `aria-hidden` was hardcoded on IconFrame; keep it at the call site — the
 * glyph only repeats the tile name printed beside it.
 *
 * `--accent-blue` on hover is the monochrome accent, i.e. the foreground
 * (spec §3a), not an informational blue.
 */
export const STAT_CARD_ICON = 'inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-base text-muted transition-[color,border-color] duration-200 ease-[ease] group-hover/card:text-foreground group-hover/card:border-foreground';

export const STAT_VALUE = 'text-[2rem] font-semibold leading-none tracking-[-0.02em] text-foreground';

export const STAT_TREND = 'flex flex-row items-center gap-1 mb-[0.3rem] text-xs font-semibold';

export const STAT_SPARKLINE = 'absolute bottom-0 right-0 pointer-events-none opacity-50 transition-opacity duration-200 ease-[ease] group-hover/card:opacity-85';

export const STAT_NAVIGATE = 'absolute top-4 right-4 text-[1.15rem] text-foreground opacity-0 transition-opacity duration-200 ease-[ease] group-hover/card:opacity-100 group-focus-visible/statbtn:opacity-100';
