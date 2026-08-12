/*
 * The dashboard's two sidebars are meant to read as a matched pair while the right panel
 * is open, so their widths have to move together. They live side by side here because each
 * needs a different Tailwind form — the right panel carries its width at every breakpoint,
 * the left rail only above the desktop breakpoint — and Tailwind only compiles class names
 * it can find as literals in the source, so neither can be derived from a shared number.
 *
 * Both resolve to 320px (80 * 0.25rem). Changing one means changing the other.
 */

/** Width of the right-hand panel (Jobs / Clusters), at every breakpoint. */
export const SIDE_PANEL_WIDTH_CLASS = 'w-80';

/**
 * Width the expanded left rail grows to while the right panel is open, so the two frame
 * the content evenly. Desktop only: below the breakpoint the left rail is an overlay
 * drawer rather than a column, so there is nothing to balance against.
 */
export const SIDEBAR_MATCHED_WIDTH_CLASS = 'min-[1024.05px]:w-80';

/** Width of the expanded left rail while the right panel is closed. */
export const SIDEBAR_RESTING_WIDTH_CLASS = 'min-[1024.05px]:w-60';
