/**
 * The class vocabulary `AIConversationThread.css` used to own, plus the two rules
 * `AIFloatingAssistantPanel.css` reached in to change.
 *
 * Every value is a complete static literal so Tailwind's scanner can see it. It lives in
 * a shared module rather than being repeated because five files in this directory paint
 * the same thread — the bubble is rendered by both `AIMessageItem` and `ThinkingBubble`,
 * and the markdown recipe by `AIMessageItem` twice.
 *
 * Two conventions worth knowing before editing:
 *
 *   1. `[.ai-floating-assistant_&]:` replaces a descendant selector in the floating
 *      panel's sheet. A descendant rule in plain CSS outranked the component's own
 *      rules; once both are utilities only the extra class in the variant's selector
 *      keeps it winning, so the override MUST stay a variant and the panel root MUST
 *      keep its `ai-floating-assistant` class.
 *   2. `MARKDOWN_PROSE` styles DOM that react-markdown generates, which no `className`
 *      reaches. Arbitrary descendant variants (`[&_p+p]:`) are the utility form of the
 *      ~40 descendant rules the stylesheet used, at the same specificity ordering — a
 *      container class plus a descendant selector, exactly as before.
 */

/** `.ai-thread-region` */
export const THREAD_REGION = 'flex min-h-0 flex-1 flex-col';

/** `.ai-thread-list`, handed to `AutoScrollList`'s className. */
export const THREAD_LIST = 'mx-auto w-[min(880px,100%)] gap-3 px-4 pt-[1.2rem] pb-3 max-md:px-3 max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] [.ai-floating-assistant_&]:p-3';

/** `.ai-thread-starter` */
export const THREAD_STARTER = 'flex flex-1 flex-col items-center justify-center gap-4 px-4 py-6';

/** `.ai-thread-starter-title` */
export const THREAD_STARTER_TITLE = 'text-center text-3xl font-medium text-foreground';

/**
 * `.ai-message-row`. `group/message` drives the hover reveal of the row's actions, which
 * was `.ai-message-row:hover .ai-message-actions`. The row's `:focus-visible` rule is
 * dropped rather than translated: the element is an `<article>` with no `tabindex`, so it
 * was never focusable and the rule never matched.
 */
export const MESSAGE_ROW = 'group/message flex min-w-0 max-w-full flex-col gap-4 max-md:max-w-[90%] [.ai-floating-assistant_&]:max-w-[92%]';

export const MESSAGE_ROW_USER = 'ml-auto items-end';

export const MESSAGE_ROW_ASSISTANT = 'mr-auto items-start';

/** `.ai-message-bubble` */
export const MESSAGE_BUBBLE = 'min-w-0 max-w-full overflow-hidden rounded-2xl px-[0.95rem] py-3 leading-[1.55] whitespace-normal';

export const MESSAGE_BUBBLE_USER = 'bg-surface-secondary text-foreground';

export const MESSAGE_BUBBLE_ASSISTANT = 'border-none bg-transparent pl-0 text-foreground';

/** `.ai-thinking-bubble` */
export const THINKING_BUBBLE = 'min-h-[1.8rem]';

/** `.ai-message-text` */
export const MESSAGE_TEXT = 'break-words';

/**
 * `.ai-message-markdown` and its ~40 descendant rules.
 *
 * `--radius-sm` (8px) became `rounded-lg` and `--radius-xs` (6px) `rounded-md`, by pixel
 * value rather than by name. `--accent-blue` resolved to the accent, which is the
 * foreground, so a markdown link is `text-foreground` + `underline`.
 */
export const MARKDOWN_PROSE = [
    'm-0 w-full overflow-x-auto leading-[1.55]',
    '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
    '[&_p]:my-[0.3rem] [&_p+p]:mt-[0.4rem]',
    '[&_ul]:my-[0.3rem] [&_ul]:pl-5 [&_ol]:my-[0.3rem] [&_ol]:pl-5',
    '[&_li]:m-0 [&_li]:pl-[0.15rem] [&_li+li]:mt-[0.1rem] [&_li>p]:m-0',
    '[&_li>ul]:mt-[0.1rem] [&_li>ul]:mb-0 [&_li>ol]:mt-[0.1rem] [&_li>ol]:mb-0',
    '[&_:is(h1,h2,h3,h4,h5,h6)]:mx-0 [&_:is(h1,h2,h3,h4,h5,h6)]:mt-[0.6rem] [&_:is(h1,h2,h3,h4,h5,h6)]:mb-1',
    '[&_:is(h1,h2,h3,h4,h5,h6)]:leading-[1.3] [&_:is(h1,h2,h3,h4,h5,h6)]:font-semibold [&_:is(h1,h2,h3,h4,h5,h6)]:text-foreground',
    '[&_h1]:text-[1.3em] [&_h2]:text-[1.15em] [&_h3]:text-[1.05em] [&_:is(h4,h5,h6)]:text-[1em]',
    '[&_code]:font-mono [&_code]:text-[0.85em]',
    '[&_pre]:my-[0.4rem] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-background [&_pre]:px-3 [&_pre]:py-[0.6rem]',
    '[&_pre_code]:whitespace-pre [&_pre_code]:text-[0.74rem]',
    '[&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:border [&_:not(pre)>code]:border-border [&_:not(pre)>code]:bg-surface-secondary [&_:not(pre)>code]:px-[0.3rem] [&_:not(pre)>code]:py-[0.1rem]',
    '[&_a]:text-foreground [&_a]:underline',
    '[&_blockquote]:my-[0.4rem] [&_blockquote]:border-l-[3px] [&_blockquote]:border-border [&_blockquote]:py-[0.15rem] [&_blockquote]:pr-0 [&_blockquote]:pl-3 [&_blockquote]:text-muted',
    '[&_blockquote>*:first-child]:mt-0 [&_blockquote>*:last-child]:mb-0',
    '[&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border',
    '[&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:border [&_table]:border-border [&_table]:border-collapse [&_table]:text-[0.82em]',
    '[&_thead]:bg-surface-secondary',
    '[&_th]:border-b [&_th]:border-border [&_th]:px-[0.6rem] [&_th]:py-[0.4rem] [&_th]:text-left [&_th]:text-[0.9em] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.03em] [&_th]:text-muted',
    '[&_td]:border-b [&_td]:border-border [&_td]:px-[0.6rem] [&_td]:py-[0.35rem]',
    '[&_tr:last-child_td]:border-b-0',
    '[&_tbody_tr:hover]:bg-surface-hover',
    '[&_strong]:font-semibold [&_strong]:text-foreground'
].join(' ');

/**
 * `.ai-message-reasoning .ai-message-markdown` and the five block margins it tightened.
 * Composed through `cn` so tailwind-merge drops the base margins it replaces. `p + p` is
 * restated because `mt-*` would otherwise beat `my-*` on property order, where the old
 * sheet won on specificity instead.
 */
export const REASONING_PROSE = 'text-muted opacity-90 [&_p]:my-[0.15rem] [&_p+p]:mt-[0.15rem] [&_ul]:my-[0.15rem] [&_ol]:my-[0.15rem] [&_pre]:my-[0.15rem] [&_blockquote]:my-[0.15rem]';

/** `.ai-message-reasoning` */
export const MESSAGE_REASONING = 'w-full rounded-none border-none bg-transparent px-0 pt-0 pb-[0.2rem] text-muted';

/** `.ai-message-reasoning-label` */
export const MESSAGE_REASONING_LABEL = 'mb-[0.1rem] block text-xs font-semibold uppercase tracking-[0.05em] text-muted';

/** `.ai-action-request-list` */
export const ACTION_REQUEST_LIST = 'flex w-full flex-col gap-2';

/** `.ai-action-request-card` */
export const ACTION_REQUEST_CARD = 'flex flex-col gap-[0.35rem] border-l-2 border-border py-2 pr-0 pl-[0.7rem] transition-colors duration-200 [.ai-floating-assistant_&]:p-2';

/** `.ai-action-request-header` */
export const ACTION_REQUEST_HEADER = 'flex flex-row items-center gap-2 leading-[1.35]';

/** `.ai-action-request-controls` */
export const ACTION_REQUEST_CONTROLS = 'mt-[0.1rem] flex flex-row items-center gap-1 [.ai-floating-assistant_&]:flex-wrap';

/** `.ai-tool-image-link` */
export const TOOL_IMAGE_LINK = 'mt-2 block overflow-hidden rounded-lg leading-none';

/** `.ai-tool-image` — `--border-subtle` was never defined, so only the fallback ever painted. */
export const TOOL_IMAGE = 'block h-auto max-w-full rounded-lg border border-[rgba(255,255,255,0.08)]';

/**
 * `.ai-message-actions`. `[@media(hover:none)]:` is the exact form of the sheet's own
 * `@media (hover: none)` block, which pins the actions visible where there is no hover.
 */
export const MESSAGE_ACTIONS = 'mt-[0.15rem] flex flex-row items-center gap-1 opacity-0 transition-opacity duration-[120ms] group-hover/message:opacity-100 group-focus-within/message:opacity-100 [@media(hover:none)]:opacity-100';

/** `.ai-message-action` */
export const MESSAGE_ACTION = 'text-muted';

/** `.ai-md-table-wrapper` */
export const MD_TABLE_WRAPPER = 'my-[0.4rem] overflow-hidden rounded-lg border border-border';

/** `.ai-md-table-scroll` */
export const MD_TABLE_SCROLL = 'overflow-x-auto';

/**
 * `.ai-md-table-wrapper table`. The `!` is load-bearing: `MARKDOWN_PROSE`'s `[&_table]:`
 * variants carry a descendant selector and so outrank a plain utility on the table
 * itself, which is precisely how the old sheet's `.ai-md-table-wrapper table` rule won.
 */
export const MD_TABLE = 'm-0! rounded-none! border-0!';

/** `.ai-open-spreadsheet-btn` */
export const MD_TABLE_OPEN_BUTTON = 'w-full justify-start rounded-none border-0 border-t border-border';
