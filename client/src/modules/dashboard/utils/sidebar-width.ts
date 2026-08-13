/*
 * Tailwind only compiles class names it can find as literals in the source, so
 * these widths cannot be derived from a shared number — each is spelled out.
 */

/** Width of the right-hand panel (Jobs / Clusters), at every breakpoint. */
export const SIDE_PANEL_WIDTH_CLASS = 'w-80';

/**
 * Width of the expanded left rail. Desktop only: below the breakpoint the rail is
 * an overlay drawer rather than a column, and carries its own fixed width.
 *
 * The rail and the right panel are mutually exclusive (see DashboardLayout), so
 * there is no second, wider "matched" width for the two being open together.
 */
export const SIDEBAR_RESTING_WIDTH_CLASS = 'min-[1024.05px]:w-60';
