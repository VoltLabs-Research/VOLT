/**
 * The chrome `DocumentListingTable.css` used to paint, now as utility strings.
 *
 * It lives in its own module because the row and its cells are rendered by
 * `TableRow` while the header, the skeleton rows and the footer are rendered by
 * `DocumentListingTable`, and both need the identical strings. The sheet expressed
 * that by having one selector match both; a shared constant is the equivalent that
 * survives without a stylesheet.
 *
 * `compact` used to be an ancestor class (`.document-listing-table-container.is-compact`)
 * that every descendant rule keyed off. It is now a prop threaded down to `TableRow`,
 * which is why each entry is a complete literal per density rather than a base string
 * plus overrides: the compact rules outranked the `max-width: 768px` ones on
 * specificity, so a compact row must not carry the responsive paddings at all.
 */
export type ListingDensity = 'default' | 'compact';

export const LISTING_ROW_CLASS_NAMES: Record<ListingDensity, string> = {
    default: 'flex items-center cursor-pointer border-b border-border last:border-b-0 px-8 py-4 transition-[background-color,box-shadow,border-color,opacity] duration-150 hover:bg-surface-hover max-md:px-4 max-md:py-3',
    compact: 'flex items-center cursor-pointer border-b border-border last:border-b-0 box-border h-7 max-h-7 px-2 py-[0.1875rem] transition-[background-color,box-shadow,border-color,opacity] duration-150 hover:bg-surface-hover'
};

/**
 * `--active-bg` / `--accent-blue` are gone; a selected row now reads as the app's
 * selected surface (`accent-soft`, which the monochrome accent makes a foreground
 * tint) plus the same 3px inset bar, drawn as a shadow so it costs no layout width.
 */
export const LISTING_ROW_SELECTED = 'bg-accent-soft shadow-[inset_3px_0_0_var(--accent)]';
export const LISTING_ROW_DRAGGING = 'opacity-65 shadow-[inset_0_0_0_1px_var(--accent)]';
export const LISTING_ROW_DRAG_OVER = 'bg-surface-hover shadow-[inset_0_0_0_1px_var(--accent)]';

export const LISTING_CELL_CLASS_NAMES: Record<ListingDensity, string> = {
    default: 'flex items-center overflow-hidden text-ellipsis whitespace-nowrap text-left no-underline text-sm text-muted max-md:text-[0.8125rem]',
    compact: 'flex items-center overflow-hidden text-ellipsis whitespace-nowrap text-left no-underline text-xs text-muted'
};

export const LISTING_CELL_NUMERIC = 'justify-end text-right tabular-nums';

export const LISTING_DRAG_HANDLE_CLASS_NAMES: Record<ListingDensity, string> = {
    default: 'inline-flex size-6 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted cursor-grab active:cursor-grabbing hover:bg-surface-hover',
    compact: 'inline-flex size-[1.125rem] shrink-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted cursor-grab active:cursor-grabbing hover:bg-surface-hover'
};

export const LISTING_CELL_CONTENT = 'flex min-w-0 items-center gap-2';
export const LISTING_CELL_VALUE_IN_CONTENT = 'min-w-0 flex-1';

/**
 * bravais's `variant='text'` skeleton painted at `scale(1, 0.6)` anchored at `0 55%`
 * while still reserving its declared height, so a loading listing was a column of
 * thin bars inside taller boxes. Reproduced so the vertical rhythm does not change;
 * the 4px radius is the one the call site used to force through inline `style`.
 */
export const LISTING_TEXT_SKELETON = 'shrink-0 origin-[0_55%] scale-y-[0.6] rounded-sm';
export const LISTING_ROUNDED_SKELETON = 'shrink-0 rounded-xl';
