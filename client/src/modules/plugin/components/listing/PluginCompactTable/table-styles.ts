/**
 * The class vocabulary `PluginExposureTable.css` and `PluginCompactTable.css` used
 * to own, as complete static literals so Tailwind's scanner sees every one.
 *
 * It lives in one module here for the same reason the two stylesheets were a
 * cross-file contract (inventory contract #30): five files paint the same grid —
 * `PluginCompactTable` (frame + sticky header), `CompactTableRow` (row + cell),
 * `CompactTableSkeleton` (all four), `cellRenderers` (the inner spans) and
 * `PluginExposureTable` (the recovery state's height). Header and body cells have
 * to agree to the pixel, exactly as `column-layout.ts` already guarantees for their
 * widths.
 *
 * ── the 27 dead colours ──────────────────────────────────────────────────────
 *
 * `PluginCompactTable.css` ended with
 *
 *     .plugin-compact-table-cell { --plugin-compact-table-cell-text-color: var(--color-text-secondary) }
 *     .plugin-compact-table-cell :where(.plugin-cell-empty, … 27 classes …) { color: var(--plugin-compact-table-cell-text-color) }
 *
 * `:where()` contributes no specificity, so that selector weighs exactly as much
 * as a bare `.plugin-cell-number` — and it came last. Nothing anywhere in the app
 * ever redefined `--plugin-compact-table-cell-text-color`, so every one of those 27
 * `color:` declarations was already overridden to the same muted grey. The cell
 * carries `text-muted` and the spans below inherit it; only their *non-colour*
 * declarations survive translation. The two exceptions are backgrounds, which the
 * blanket never touched.
 *
 * ── two tokens that were never defined ───────────────────────────────────────
 *
 * The bool cell's tints read `var(--color-success, #16a34a)` and
 * `var(--color-danger, …)`. `--color-success` is one of the 27 names nothing ever
 * declared (HeroUI declares it inside `@theme inline`, which emits no custom
 * property), so it has always resolved to the hardcoded fallback. Per spec §3a a
 * hue that carries meaning survives as itself, so both become the real status
 * tokens — `bg-success/14` and `bg-danger/12` — rather than preserving a literal
 * that was only ever a fallback.
 */

/** `.plugin-exposure-table-compact` */
export const TABLE_FRAME_CLASS = 'flex h-full w-full flex-col overflow-hidden';

/** `.plugin-compact-table-header` — `sticky` stays on the element, `top-0` here. */
export const TABLE_HEADER_CLASS = 'sticky top-0 z-10 flex flex-row justify-between border-b border-border pb-[5px]';

/** `.plugin-compact-table-header-cell` */
export const TABLE_HEADER_CELL_CLASS = 'overflow-hidden whitespace-nowrap text-ellipsis px-2 py-1 text-[0.6875rem] font-medium text-muted max-[768px]:px-1 max-[768px]:text-[0.625rem]';

/** `.plugin-compact-table-row` plus its `:hover`. */
export const TABLE_ROW_CLASS = 'flex flex-row justify-between hover:bg-surface-hover';

/**
 * `.plugin-compact-table-row--interactive`. The inset ring replaces the outline
 * `index.css` gives every `[tabindex]` element, which is why `outline-none` is here
 * — that global rule is a `:where()`, so a utility beats it.
 */
export const TABLE_ROW_INTERACTIVE_CLASS = 'cursor-pointer transition-colors duration-[120ms] ease-out focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--accent)]';

/** `.plugin-compact-table-row--selected` plus its `:hover`. */
export const TABLE_ROW_SELECTED_CLASS = 'bg-accent/12 hover:bg-accent/18';

/** `.plugin-compact-table-cell`, including the colour the 27-arm blanket settled on. */
export const TABLE_CELL_CLASS = 'flex flex-row items-center overflow-hidden whitespace-nowrap text-ellipsis px-2 py-[0.1875rem] text-xs text-muted max-[768px]:px-1 max-[768px]:text-[0.625rem]';

/** `.plugin-exposure-loading`, with the inline `padding` that used to override it. */
export const TABLE_LOADING_CLASS = 'border-t border-border p-1 text-center text-xs text-muted';

/** `.plugin-exposure-recovery-state` */
export const TABLE_RECOVERY_STATE_CLASS = 'min-h-[240px]';
