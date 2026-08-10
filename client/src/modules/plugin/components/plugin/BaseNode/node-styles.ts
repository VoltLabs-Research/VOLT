import { DebugNodeStatus } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import type { DebugExecutionLogSegment, DebugTraceNode } from '@/modules/plugin/store/plugin/use-plugin-debug-store';

/**
 * `BaseNode.css`'s vocabulary, as complete static literals.
 *
 * It is one module because four files paint the same node — `BaseNode` itself,
 * `NodeDebugOutput`, `NodeExecutionLog` and `use-node-debug-view`, which used to
 * hand back a *class name* (`workflow-node--debug-${status}`) and now hands back the
 * utilities for that status. Every lookup below is keyed by an enum or a union, so
 * every value is a whole class string the scanner can see; nothing is interpolated.
 *
 * Two conversions worth knowing:
 *
 *   • `--accent-blue` is `--accent` (spec §3a), which is why every "this node is
 *     live / selected" edge is `border-accent` rather than a blue.
 *   • `--color-border-strong` is `--border-secondary`, so the trace's "skipped" grey
 *     is `text-border-secondary` / `bg-border-secondary/8`. It reads as a
 *     deliberately dim neutral, which is what it was.
 *
 * The one rule that could NOT become a utility is `--debug-running`'s pulse: it is a
 * two-layer animated `box-shadow`, so `@keyframes debug-node-pulse` has to live in
 * the global sheet. The `animate-[…]` utility below names it; the keyframes block is
 * reported separately.
 */

/** `.workflow-node-wrapper` */
export const NODE_WRAPPER_CLASS = 'relative inline-flex flex-col items-center';

/** `.workflow-node-wrapper--has-badge` */
export const NODE_WRAPPER_BADGE_CLASS = 'pt-5';

/** `.workflow-node-overhead-badge` */
export const NODE_BADGE_CLASS = 'absolute top-0 left-1/2 -translate-x-1/2 z-[1] pointer-events-none whitespace-nowrap rounded-full px-[0.4rem] py-[0.05rem] text-[0.6rem] font-semibold';

/** `.workflow-node` */
export const NODE_CLASS = 'relative max-w-[300px] rounded-2xl border border-border bg-surface px-6 py-4 transition-[border-color,opacity,box-shadow] duration-200 ease-out';

/** `.workflow-node--selected` */
export const NODE_SELECTED_CLASS = 'border-accent';

/** `.workflow-node-description` */
export const NODE_DESCRIPTION_CLASS = 'line-clamp-2 overflow-hidden text-[0.8rem] text-muted';

/**
 * `.workflow-node--debug-*`. `pending` and `skipped` only dim; `running` and
 * `failed` also ring. The `running` ring is the animated one.
 */
export const NODE_DEBUG_STATUS_CLASS: Record<DebugNodeStatus, string> = {
    [DebugNodeStatus.Pending]: 'opacity-50',
    [DebugNodeStatus.Running]: 'border-accent shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_30%,transparent),0_0_16px_color-mix(in_srgb,var(--accent)_15%,transparent)] animate-[debug-node-pulse_1.5s_ease-in-out_infinite]',
    [DebugNodeStatus.Completed]: 'border-success',
    [DebugNodeStatus.Failed]: 'border-danger shadow-[0_0_0_2px_color-mix(in_srgb,var(--danger)_30%,transparent)]',
    [DebugNodeStatus.Skipped]: 'opacity-40 border-dashed'
};

/** `.workflow-node-btn-group` */
export const NODE_BTN_GROUP_CLASS = 'absolute top-full left-1/2 z-[2] mt-[0.35rem] -translate-x-1/2 inline-flex flex-row items-center gap-[0.3rem]';

/** `.workflow-node-data-btn` */
export const NODE_DATA_BTN_CLASS = 'inline-flex cursor-pointer flex-row items-center gap-1 whitespace-nowrap rounded-full border border-border bg-surface-secondary/80 px-2 py-[0.15rem] font-[inherit] text-[0.6rem] text-muted transition-[color,border-color,background-color] duration-150 hover:border-border-secondary hover:text-inherit';

/** `.workflow-node-data-btn--active` */
export const NODE_DATA_BTN_ACTIVE_CLASS = 'border-accent bg-accent/8 text-accent';

/* ── the debug output overlay ─────────────────────────────────────────────── */

/** `.workflow-node-debug-output` */
export const NODE_DEBUG_OUTPUT_CLASS = 'absolute left-1/2 top-[calc(100%+2rem)] w-[300px] max-h-[260px] -translate-x-1/2 overflow-y-auto rounded-md border border-border bg-surface-secondary p-2';

/** `.workflow-node-debug-tree` */
export const NODE_DEBUG_TREE_CLASS = 'flex flex-col gap-2 font-mono text-xs leading-normal';

/** `.workflow-node-debug-error` */
export const NODE_DEBUG_ERROR_CLASS = 'flex flex-col gap-1 rounded-2xl bg-danger/8 p-2 text-xs text-danger';

/** `.workflow-node-debug-skipped` */
export const NODE_DEBUG_SKIPPED_CLASS = 'flex flex-col gap-[0.35rem] rounded-2xl bg-border-secondary/8 p-2 text-xs text-border-secondary';

/** `.workflow-node-debug-stack` */
export const NODE_DEBUG_STACK_CLASS = 'm-0 whitespace-pre-wrap break-all font-mono text-[0.625rem] opacity-80';

/* ── the nested execution trace ───────────────────────────────────────────── */

/** `.workflow-node-trace-panel` */
export const TRACE_PANEL_CLASS = 'flex flex-col gap-[0.35rem] border-t border-border/80 pt-[0.35rem]';

/** `.workflow-node-trace-tree` */
export const TRACE_TREE_CLASS = 'flex flex-col gap-[0.35rem]';

/**
 * `.workflow-node-trace-tree--depth-1|2|3`. Only those three were declared, so a
 * trace nested four deep flattens — preserved rather than generalised.
 */
export const TRACE_TREE_INDENT_CLASS = 'ml-[0.6rem] border-l border-border/80 pl-[0.55rem]';
const MAX_INDENTED_TRACE_DEPTH = 3;

export const resolveTraceTreeIndentClass = (depth: number): string | null => (
    depth >= 1 && depth <= MAX_INDENTED_TRACE_DEPTH ? TRACE_TREE_INDENT_CLASS : null
);

type TraceStatus = DebugTraceNode['status'];

/** `.workflow-node-trace-item` */
export const TRACE_ITEM_CLASS = 'rounded-[0.35rem] border bg-surface-tertiary/85 px-[0.4rem] py-[0.35rem]';

/** `.workflow-node-trace-item--completed|skipped|error` */
export const TRACE_ITEM_STATUS_CLASS: Record<TraceStatus, string> = {
    completed: 'border-[color-mix(in_srgb,var(--success)_25%,var(--border))]',
    skipped: 'border-[color-mix(in_srgb,var(--border-secondary)_30%,var(--border))]',
    error: 'border-[color-mix(in_srgb,var(--danger)_30%,var(--border))]'
};

/** `.workflow-node-trace-row` */
export const TRACE_ROW_CLASS = 'flex flex-row items-start justify-between gap-2 text-[0.7rem]';

/** `.workflow-node-trace-status` */
export const TRACE_STATUS_CLASS = 'inline-flex flex-row items-center justify-center mt-[0.1rem]';

/** `.workflow-node-trace-status--completed|skipped|error` */
export const TRACE_STATUS_TONE_CLASS: Record<TraceStatus, string> = {
    completed: 'text-success',
    skipped: 'text-border-secondary',
    error: 'text-danger'
};

/** `.workflow-node-trace-title` */
export const TRACE_TITLE_CLASS = 'text-[0.72rem] font-semibold';

/** `.workflow-node-trace-meta` */
export const TRACE_META_CLASS = 'break-all text-[0.62rem] leading-[1.3] text-muted';

/** `.workflow-node-trace-duration` */
export const TRACE_DURATION_CLASS = 'whitespace-nowrap font-mono text-[0.58rem] text-muted';

/** `.workflow-node-trace-details` */
export const TRACE_DETAILS_CLASS = 'flex flex-col gap-[0.35rem] mt-[0.35rem]';

/** `.workflow-node-trace-message` */
export const TRACE_MESSAGE_CLASS = 'rounded-[0.3rem] px-[0.4rem] py-[0.35rem]';

/** `.workflow-node-trace-message--error` */
export const TRACE_MESSAGE_ERROR_CLASS = 'bg-danger/8 text-danger';

/** `.workflow-node-trace-message--skipped` */
export const TRACE_MESSAGE_SKIPPED_CLASS = 'bg-border-secondary/8 text-border-secondary';

/** `.workflow-node-trace-json` */
export const TRACE_JSON_CLASS = 'rounded-[0.3rem] bg-surface-secondary/82 px-[0.3rem] py-[0.25rem]';

/** `.workflow-node-trace-children` */
export const TRACE_CHILDREN_CLASS = 'pt-[0.15rem]';

/* ── the execution log overlay ────────────────────────────────────────────── */

/** `.workflow-node-exec-log` */
export const EXEC_LOG_CLASS = 'absolute left-1/2 top-[calc(100%+2rem)] z-[5] w-[300px] -translate-x-1/2 overflow-hidden rounded-md border border-border bg-surface-secondary';

/** `.workflow-node-exec-log-header` */
export const EXEC_LOG_HEADER_CLASS = 'flex flex-row items-center gap-1 border-b border-border px-2 py-[0.4rem] text-muted';

/** `.workflow-node-exec-log-exit` */
export const EXEC_LOG_EXIT_CLASS = 'ml-auto rounded-full font-mono text-[0.55rem]';

/** `.workflow-node-exec-log-content` */
export const EXEC_LOG_CONTENT_CLASS = 'm-0 max-h-[220px] overflow-y-auto whitespace-pre-wrap break-words p-2 font-mono text-[0.65rem] leading-[1.6]';

/** `.workflow-node-exec-log-stdout` */
export const EXEC_LOG_STDOUT_CLASS = 'text-foreground';

/** `.workflow-node-exec-log-stderr` */
export const EXEC_LOG_STDERR_CLASS = 'text-danger';

/** `.workflow-node-exec-log-empty` */
export const EXEC_LOG_EMPTY_CLASS = 'italic text-muted';

/**
 * `.workflow-node-exec-log-chunk--stderr|system`. `stdout` had no rule of its own —
 * it inherits the content block — so it maps to nothing rather than to
 * `EXEC_LOG_STDOUT_CLASS`, which belongs to the *fallback* stdout span.
 */
export const EXEC_LOG_CHUNK_CLASS: Record<DebugExecutionLogSegment['stream'], string | null> = {
    stdout: null,
    stderr: 'text-danger',
    system: 'text-accent'
};
