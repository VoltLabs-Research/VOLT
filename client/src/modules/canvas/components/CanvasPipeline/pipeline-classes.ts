/**
 * `CanvasPipeline.css`, which was already utility-shaped.
 *
 * The one thing that could not move to an element as-is: the gear and the remove button
 * fade in from `.canvas-pipeline-stage:hover` and `:focus-within`, i.e. from the *stage*,
 * not from themselves. Those become `group-hover:` / `group-focus-within:` with `group`
 * on the stage — the direct Tailwind equivalent — rather than descendant variants.
 *
 * `--color-surface-1` is `--surface-secondary`, `--status-error` is `--danger`, and the
 * `:focus-visible` ring on `.canvas-code-input` is dropped because `index.css` rings every
 * plain input globally.
 */

/** `.canvas-pipeline` / `__list` */
export const PIPELINE_CLASS = 'flex flex-col gap-2 p-1.5';

export const PIPELINE_LIST_CLASS = 'flex flex-col gap-1';

/** `.canvas-pipeline-stage` — `group` is what the gear and remove button fade off. */
export const STAGE_CLASS = 'group overflow-hidden rounded-lg border border-border';

export const STAGE_DRAGGING_CLASS = 'opacity-50';

/** `.canvas-pipeline-stage__header` */
export const STAGE_HEADER_CLASS = 'flex flex-row items-center gap-2 px-1.5 py-1';

export const STAGE_HEADER_DISABLED_CLASS = 'opacity-55';

/** `.canvas-pipeline-stage__grip` / `__icon` */
export const STAGE_GRIP_CLASS = 'flex cursor-grab items-center text-muted';

export const STAGE_ICON_CLASS = 'flex items-center text-muted';

/** `.canvas-pipeline-stage__select` */
export const STAGE_SELECT_CLASS = 'flex min-w-0 flex-1 cursor-pointer select-none items-center gap-1.5 border-none bg-transparent p-0 text-inherit';

/** `.canvas-pipeline-stage__label` */
export const STAGE_LABEL_CLASS = 'min-w-0 flex-1 truncate text-left text-sm';

/** `.canvas-pipeline-stage__gear` */
export const STAGE_GEAR_CLASS = 'ml-auto flex items-center text-muted opacity-0 transition-opacity duration-[120ms] ease-out group-hover:opacity-100 group-focus-within:opacity-100';

/** `.canvas-pipeline-stage__actions` / `__action` / `__action--remove` */
export const STAGE_ACTIONS_CLASS = 'flex shrink-0 flex-row items-center gap-1';

export const STAGE_ACTION_CLASS = 'flex cursor-pointer items-center rounded-lg border-none bg-transparent p-0.5 text-muted hover:text-foreground';

export const STAGE_ACTION_REMOVE_CLASS = 'opacity-0 transition-opacity duration-[120ms] ease-out hover:text-danger group-hover:opacity-100 group-focus-within:opacity-100';

/** `.canvas-plugin-popover-content` — caps the height so a long argument list scrolls. */
export const PLUGIN_POPOVER_CONTENT_CLASS = 'flex min-w-[min(21rem,calc(100vw-3rem))] max-h-[min(70vh,32rem)] flex-col overflow-hidden origin-top-right';

/** `.context-menu-popover--plugin-config` */
export const PLUGIN_CONFIG_PANEL_CLASS = 'min-w-[min(22rem,calc(100vw-2rem))] max-w-[min(24rem,calc(100vw-2rem))]';

/** `.canvas-code-input` */
export const CODE_INPUT_CLASS = 'w-full rounded-lg border border-border bg-surface-secondary px-2 py-1.5 font-mono text-xs leading-[1.4] text-foreground';

/** `.expression-select-chip` and its parts. */
export const EXPRESSION_CHIP_CLASS = 'w-full';

export const EXPRESSION_CHIP_INPUT_CLASS = 'w-full resize-y';

export const EXPRESSION_CHIP_MATCH_COUNT_CLASS = 'ml-auto';

export const EXPRESSION_CHIP_ERROR_CLASS = 'text-danger';

export const EXPRESSION_CHIP_COLOR_CLASS = 'h-5 w-7 cursor-pointer rounded border border-border bg-transparent p-0';
