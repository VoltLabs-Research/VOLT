/**
 * `PluginBuilder.css`'s vocabulary, as complete static literals.
 *
 * One module because the sheet was never one component's: it painted the canvas
 * empty state, the canvas toolbar, and the floating node panel — three components in
 * three directories — because all three are chrome layered over the same xyflow
 * surface. Only two of its rules could not become utilities, and both are reported
 * for the global sheet rather than kept here: `.react-flow__minimap`, which is a
 * library element no `className` reaches, and `@keyframes debug-node-pulse` from
 * `BaseNode.css`.
 *
 * ── the toolbar, which no longer positions itself ────────────────────────────
 *
 * The canvas toolbar was a bravais `FloatingToolbar placement='bottom'
 * align='center' offset={1.25}`, which is `position: absolute; z-index: 10` plus
 * `left: 50%; transform: translateX(-50%)` from its align variant, plus an inline
 * `bottom: 1.25rem` from `offset`. All of that is inlined below, which resolves two
 * things the stylesheet declared but never got:
 *
 *   • its mobile `bottom: 0.75rem` lost to that inline `bottom` and never applied;
 *     as a utility it now does, which is plainly what it was written for.
 *   • its mobile `left/right: 0.5rem` never cancelled the centring transform, so the
 *     toolbar sat half its own width off-centre on a phone. `translate-x-0` cancels
 *     it, since a box pinned on both edges needs no centring.
 *
 * ── the floating panel's mobile takeover ─────────────────────────────────────
 *
 * `.floating-node-panel` is positioned from JavaScript (`top` / `right` / `maxHeight`
 * as inline styles, computed against the canvas rect), and below 768px the sheet
 * overrode all of it with `!important` to become a bottom sheet. Tailwind's trailing
 * `!` emits the same `!important`, so this stays a utility rather than becoming a
 * bespoke rule — an inline style is the one thing a plain class cannot outrank.
 * `max-height` is the exception: it was declared *without* `!important`, so the
 * inline value has always won. It is restated here in the same losing position
 * rather than silently promoted.
 */

/**
 * bravais's `Callout` painted a soft fill plus a tinted hairline; HeroUI's `Alert`
 * paints `bg-surface` and tints only the title and indicator. These utilities put the
 * fill back, so a danger callout still reads as a danger surface rather than as one
 * more panel. `--status-error-bg` is `--danger-soft`, `--status-error-border` was
 * `color-mix(… danger 24% …)`, and `--radius-md` is 12px → `rounded-xl` (spec §3b).
 * `justify-between items-center` restores the `Row justify='between'` that bravais's
 * stacked layout put around the body and its action.
 */
export const CALLOUT_DANGER_CLASS = 'flex-row items-center justify-between rounded-xl border border-danger/24 bg-danger-soft p-4 shadow-none';

/* ── the palette ──────────────────────────────────────────────────────────── */

/** `.plugin-builder-palette-list-container` */
export const PALETTE_LIST_CLASS = 'flex flex-col gap-6 overflow-y-auto p-8';

/* ── the empty state ──────────────────────────────────────────────────────── */

/** `.canvas-empty-state` */
export const EMPTY_STATE_CLASS = 'absolute inset-0 z-10 flex flex-row items-center justify-center pointer-events-none';

/** `.canvas-empty-state-card` */
export const EMPTY_STATE_CARD_CLASS = 'pointer-events-auto flex max-w-[420px] flex-col items-center gap-4 border border-border bg-surface px-12 py-10 text-center max-[768px]:max-w-[calc(100vw-2rem)] max-[768px]:px-5 max-[768px]:py-6';

/**
 * `.canvas-empty-state-icon-wrapper`. `--status-info-bg` is `--info-soft` and
 * `--accent-blue` is `--accent` (spec §3a), so the tint keeps its informational hue
 * while the glyph follows the monochrome accent.
 */
export const EMPTY_STATE_ICON_CLASS = 'flex size-14 flex-row items-center justify-center rounded-xl bg-info-soft text-accent';

/** `.canvas-empty-state-description` */
export const EMPTY_STATE_DESCRIPTION_CLASS = 'max-w-[320px] text-xs leading-normal text-muted';

/** `.canvas-empty-state-flow` */
export const EMPTY_STATE_FLOW_CLASS = 'flex w-full flex-row flex-wrap items-center justify-center gap-1 border-t border-border pt-3';

/* ── the canvas toolbar ───────────────────────────────────────────────────── */

/** bravais `FloatingToolbar placement='bottom' align='center' offset={1.25}` + `.canvas-toolbar`. */
export const CANVAS_TOOLBAR_CLASS = 'absolute bottom-5 left-1/2 z-10 inline-flex -translate-x-1/2 flex-row items-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface px-2 py-1.5 max-[768px]:bottom-3 max-[768px]:left-2 max-[768px]:right-2 max-[768px]:max-w-[calc(100vw-1rem)] max-[768px]:translate-x-0 max-[768px]:flex-wrap max-[768px]:justify-center';

/** `.canvas-toolbar-status` */
export const CANVAS_TOOLBAR_STATUS_CLASS = 'whitespace-nowrap px-2';

/** `.canvas-toolbar-status--error` */
export const CANVAS_TOOLBAR_STATUS_ERROR_CLASS = 'text-danger';

/** `.canvas-toolbar-zoom-label` */
export const CANVAS_TOOLBAR_ZOOM_LABEL_CLASS = 'min-w-[42px] select-none text-center text-xs tabular-nums text-muted';

/** `.canvas-toolbar-divider` */
export const CANVAS_TOOLBAR_DIVIDER_CLASS = 'mx-1 h-5 bg-border-secondary max-[768px]:hidden';

/** `.canvas-toolbar-validation` */
export const CANVAS_TOOLBAR_VALIDATION_CLASS = 'absolute bottom-18 left-1/2 z-10 w-max max-w-[min(420px,calc(100vw-2rem))] -translate-x-1/2';

/** `.canvas-toolbar-validation-list` */
export const CANVAS_TOOLBAR_VALIDATION_LIST_CLASS = 'm-0 flex flex-col gap-1 list-disc pl-4';

/* ── the floating node panel ───────────────────────────────────────────────── */

/** `.floating-node-panel`, including the `!important` mobile bottom sheet. */
export const FLOATING_PANEL_CLASS = 'absolute z-[100] flex w-[400px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--overlay-shadow)] max-[768px]:fixed! max-[768px]:inset-auto! max-[768px]:bottom-2! max-[768px]:left-2! max-[768px]:right-2! max-[768px]:top-auto! max-[768px]:w-auto! max-[768px]:max-w-[calc(100vw-1rem)]! max-[768px]:max-h-[min(70dvh,560px)] max-[768px]:rounded-xl';

/** `.floating-node-panel-header` */
export const FLOATING_PANEL_HEADER_CLASS = 'flex shrink-0 flex-row items-center gap-3 border-b border-border p-4';

/** `.floating-node-panel-tabs` */
export const FLOATING_PANEL_TABS_CLASS = 'shrink-0 px-4 pt-3 max-[768px]:px-3 max-[768px]:pt-2';

/** `.floating-node-panel-body` */
export const FLOATING_PANEL_BODY_CLASS = 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 max-[768px]:p-3';

/** `.floating-node-panel-description` */
export const FLOATING_PANEL_DESCRIPTION_CLASS = 'mb-3 border-b border-border pb-3 text-xs text-muted';

/** `.floating-node-panel-footer` */
export const FLOATING_PANEL_FOOTER_CLASS = 'shrink-0 border-t border-border px-4 py-3';
