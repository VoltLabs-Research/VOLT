/**
 * `AnalysisExecutionOverlay.css`, minus the two rules that genuinely cannot be utilities
 * (both reported for the global sheet):
 *
 *   - the transitioned `mask-image` fade on `--completed`, which needs a `-webkit-`
 *     twin *inside* a transition list, and
 *   - `backdrop-filter: blur(8px) brightness(1.3) saturate(0.6)`, three filter functions
 *     in one declaration that Tailwind's separate `backdrop-*` utilities cannot compose
 *     into a single value.
 *
 * The chip and duration reveal is a `group-hover:` / `group-focus-within:` pair rather
 * than a descendant selector off the overlay — the same relationship, expressed the
 * Tailwind way. It stays a `visibility` + `opacity` pair because that is what fades the
 * text in without it ever being reachable while hidden.
 *
 * `--accent-blue` is the accent, `--status-error` is `--danger`, and `--radius-2xl` /
 * `--radius-lg` are 24px / 16px in bravais's scale, which is `rounded-3xl` / `rounded-2xl`
 * (spec §3b).
 */

export const OVERLAY_CLASS = 'group pointer-events-auto absolute bottom-20 left-4 z-[4] w-[min(320px,calc(100%-2rem))] max-h-[min(42vh,360px)] overflow-auto rounded-3xl px-2.5 py-2 max-md:left-0 max-md:z-[150] max-md:w-[min(240px,calc(100%-1rem))] max-md:max-h-30 max-md:rounded-2xl max-md:px-2 max-md:py-1.5';

/** `.canvas-analysis-execution-overlay--completed` is hidden entirely under 768px. */
export const OVERLAY_COMPLETED_CLASS = 'max-md:hidden';

/** `.canvas-analysis-execution-overlay .canvas-tree-execution-block` */
export const EXECUTION_BLOCK_CLASS = 'm-0 border-l-0 p-0';

/** `.canvas-tree-execution-row` */
export const EXECUTION_ROW_CLASS = 'flex min-h-[22px] items-center gap-1.5 text-[0.72rem] text-muted max-md:min-h-[18px] max-md:gap-1 max-md:text-[0.625rem]';

/**
 * The row tones. `completed` and `cached` rows are hidden under 768px — the mobile
 * overlay only shows what is still happening.
 */
export const EXECUTION_ROW_TONE_CLASS = {
    running: '[&_[data-execution-label]]:text-accent',
    completed: '[&_[data-execution-label]]:text-success max-md:hidden',
    cached: '[&_[data-execution-label]]:text-success max-md:hidden',
    failed: '[&_[data-execution-label]]:text-danger'
} as const;

/** `.canvas-tree-execution-label` */
export const EXECUTION_LABEL_CLASS = 'min-w-0 flex-auto truncate';

/** `.canvas-tree-execution-icon` and its status tones. */
export const EXECUTION_ICON_CLASS = 'inline-flex size-3.5 items-center justify-center text-muted';

export const EXECUTION_ICON_TONE_CLASS = {
    running: 'text-accent',
    completed: 'text-success',
    cached: 'text-success',
    failed: 'text-danger'
} as const;

/** `.canvas-tree-execution-chip` / `-duration` */
export const EXECUTION_META_CLASS = 'invisible flex-none text-[0.65rem] leading-none text-muted opacity-0 transition-[opacity,visibility] duration-[120ms] ease-out group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 max-md:hidden';

export const EXECUTION_CHIP_CLASS = 'px-1 py-0.5';
