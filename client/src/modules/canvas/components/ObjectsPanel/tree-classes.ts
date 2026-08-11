/**
 * The `canvas-tree-*` vocabulary `ObjectsPanel.css` owned, shared by `CanvasTree`,
 * `SceneCollection`, `ArtifactTreeSection` and `AnalysisTreeNode`.
 *
 * **The compact variants are ancestor-flag variants, not props.** Every one of them was
 * `.canvas-objects-panel--analysis-compact .canvas-tree-…`, and the tree components are
 * several levels below that panel with no `compact` prop threaded through them. Written
 * as `[.canvas-objects-panel--analysis-compact_&]:` they keep matching, and — this is the
 * point of spec §5b.3 — they outrank the base utilities on the same element because the
 * generated selector carries the extra class.
 *
 * `.canvas-tree-container` keeps its marker class: `RightCollapsible`'s body re-selects it
 * to flatten the horizontal padding inside a dropdown, which is where every tree lives.
 * That rule wins on specificity for the base padding, and — as it did before this
 * migration, where the two rules tied and `RightPanel.css` loaded second — it also wins
 * over the compact override, so the compact container padding is not carried over.
 *
 * Two colour notes: `--hover-bg` is `--surface-hover`, and `--selected-indicator` is
 * `--accent`, which VOLT collapsed onto the foreground.
 */

/** `.canvas-tree-container` */
export const TREE_CONTAINER_CLASS = 'canvas-tree-container flex flex-col gap-1 overflow-auto px-2 pb-2.5 pt-1.5';

/** `.canvas-tree-item` and its two indents. */
export const TREE_ITEM_CLASS = 'relative w-full border-none bg-transparent px-2.5 py-2 text-left [.canvas-objects-panel--analysis-compact_&]:min-h-[26px] [.canvas-objects-panel--analysis-compact_&]:gap-1 [.canvas-objects-panel--analysis-compact_&]:px-1.5 [.canvas-objects-panel--analysis-compact_&]:py-1 [.canvas-objects-panel--analysis-compact_&]:text-[0.6875rem]';

export const TREE_ITEM_INDENT_CLASS = {
    base: 'pl-4 [.canvas-objects-panel--analysis-compact_&]:pl-2.5',
    lg: 'pl-8 [.canvas-objects-panel--analysis-compact_&]:pl-[18px]'
} as const;

/** `.canvas-tree-item:hover` — suppressed while disabled, as before. */
export const TREE_ITEM_HOVER_CLASS = 'hover:rounded-md hover:bg-surface-hover';

/** `.canvas-tree-item.is-disabled` */
export const TREE_ITEM_DISABLED_CLASS = 'cursor-not-allowed opacity-65';

/** `.canvas-tree-item.selected` */
export const TREE_ITEM_SELECTED_CLASS = 'text-accent';

/** `.canvas-tree-item__text` */
export const TREE_ITEM_TEXT_CLASS = 'min-w-0 flex-1 truncate';

/** `.canvas-tree-spacer` — the placeholder that keeps a row's icon column aligned. */
export const TREE_SPACER_CLASS = 'size-[13px] [.canvas-objects-panel--analysis-compact_&]:size-[11px]';

/** `.canvas-tree-group` / `-header` / `-chevron` / `-count` */
export const TREE_GROUP_CLASS = 'mt-1';

export const TREE_GROUP_HEADER_CLASS = 'w-full cursor-pointer rounded-md border-none bg-transparent px-1.5 py-1 text-left text-muted hover:bg-surface-hover';

export const TREE_GROUP_CHEVRON_CLASS = 'transition-transform duration-150 ease-out';

export const TREE_GROUP_CHEVRON_COLLAPSED_CLASS = '-rotate-90';

export const TREE_GROUP_COUNT_CLASS = 'text-[11px] text-muted';

/** `.canvas-tree-show-more` */
export const TREE_SHOW_MORE_CLASS = 'mx-2 mb-1.5 mt-1 cursor-pointer rounded-md border border-dashed border-border bg-transparent px-2.5 py-1.5 text-center text-xs text-muted transition-[background-color,border-color] duration-[120ms] ease-out hover:border-border-secondary hover:bg-surface-hover';

/** `.canvas-tree-analysis-label-group` / `-config-hint` / `-name` */
export const TREE_ANALYSIS_LABEL_GROUP_CLASS = 'flex min-w-0 flex-[0_1_auto] flex-col gap-px';

export const TREE_ANALYSIS_CONFIG_HINT_CLASS = 'truncate text-[0.7rem] leading-[1.2] text-muted opacity-90';

export const TREE_ANALYSIS_NAME_CLASS = 'min-w-0 flex-[0_1_auto] transition-[color,text-shadow] duration-[180ms]';

/**
 * The four analysis tones, each with its light-theme ink. The light values are literal
 * hexes in the original — deliberately, because the dark hues do not read on a white
 * panel — so they stay literal.
 */
export const TREE_ANALYSIS_NAME_TONE_CLASS = {
    queued: 'text-warning [[data-theme=light]_&]:text-[#8a5300]',
    running: 'text-accent [[data-theme=light]_&]:text-[#0a5fbf]',
    completed: 'text-success [text-shadow:0_0_10px_color-mix(in_srgb,var(--success)_35%,transparent)] [[data-theme=light]_&]:text-[#0f7a34] [[data-theme=light]_&]:[text-shadow:0_0_10px_color-mix(in_srgb,#0f7a34_25%,transparent)]',
    failed: 'text-danger [[data-theme=light]_&]:text-[#c41e1e]'
} as const;

/** `.canvas-tree-artifact-label` and the tone its `> .truncate` child took. */
export const TREE_ARTIFACT_LABEL_CLASS = 'flex w-full min-w-0 items-center gap-1.5 [&>.truncate]:min-w-0 [&>.truncate]:transition-[color,text-shadow] [&>.truncate]:duration-[180ms]';

export const TREE_ARTIFACT_LABEL_TONE_CLASS = {
    pending: '[&>.truncate]:text-warning [[data-theme=light]_&]:[&>.truncate]:text-[#8a5300]',
    generating: '[&>.truncate]:text-accent [[data-theme=light]_&]:[&>.truncate]:text-[#0a5fbf]',
    uploading: '[&>.truncate]:text-accent [[data-theme=light]_&]:[&>.truncate]:text-[#0a5fbf]',
    'ready-recent': '[&>.truncate]:text-success [&>.truncate]:[text-shadow:0_0_10px_color-mix(in_srgb,var(--success)_35%,transparent)] [[data-theme=light]_&]:[&>.truncate]:text-[#0f7a34]',
    failed: '[&>.truncate]:text-danger [[data-theme=light]_&]:[&>.truncate]:text-[#c41e1e]'
} as const;

/** `.canvas-tree-artifact-icon` and its status tones. */
export const TREE_ARTIFACT_ICON_CLASS = 'inline-flex size-[13px] items-center justify-center text-muted';

export const TREE_ARTIFACT_ICON_TONE_CLASS = {
    generating: 'text-accent',
    uploading: 'text-accent',
    ready: 'text-success',
    failed: 'text-danger'
} as const;

/** `.canvas-tree-toggle.button.icon-only` — an icon button stripped back to bare glyph. */
export const TREE_TOGGLE_CLASS = 'size-auto min-h-0 min-w-0 border-0 bg-transparent p-0 text-muted';

/** `.volt-tooltip.canvas-tree-config-tooltip` and its three parts. */
export const CONFIG_TOOLTIP_CLASS = 'pointer-events-auto w-[min(32rem,calc(100vw-2rem))] max-w-[32rem] whitespace-normal border border-border bg-surface p-0 shadow-[0_0_0_1px_var(--border)]';

export const CONFIG_TOOLTIP_BODY_CLASS = 'max-h-[min(22rem,calc(100dvh-6rem))] overflow-auto overscroll-contain';

export const CONFIG_TOOLTIP_EMPTY_CLASS = 'p-3 text-xs text-muted';

export const CONFIG_TOOLTIP_WARNING_CLASS = 'border-b border-border px-3 py-2 text-xs text-warning';

/** `.canvas-objects-panel` and its two regions. */
export const OBJECTS_PANEL_CLASS = 'canvas-objects-panel flex h-full min-h-0 flex-col justify-between overflow-hidden';

export const OBJECTS_PANEL_COMPACT_CLASS = 'canvas-objects-panel--analysis-compact justify-start';

export const OBJECTS_PANEL_TOP_CLASS = 'flex min-h-0 flex-auto flex-col overflow-y-auto [&>:first-child]:mt-2';

export const OBJECTS_PANEL_BOTTOM_CLASS = 'flex flex-none flex-col border-t border-border';

/** `.canvas-raster-container-panels` / `-panel--active` / `-panel__summary` */
export const RASTER_PANELS_CLASS = 'flex flex-col gap-2 px-1.5 pb-3 pt-1.5';

export const RASTER_PANEL_ACTIVE_CLASS = 'rounded-lg border border-border';

export const RASTER_PANEL_SUMMARY_CLASS = 'cursor-pointer rounded-full border border-transparent bg-transparent px-[0.55rem] py-[0.3rem] text-[11px] leading-none text-muted';

export const RASTER_PANEL_SUMMARY_ACTIVE_CLASS = 'border-border bg-surface-tertiary text-foreground';
