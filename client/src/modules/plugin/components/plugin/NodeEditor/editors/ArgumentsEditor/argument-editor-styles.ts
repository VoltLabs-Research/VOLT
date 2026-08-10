/**
 * `ArgumentDefinitionSection.css` + `ArgumentOptionsEditor.css`, as complete static
 * literals. One module because the two sheets already shared a vocabulary across
 * three components: `ArgumentDefinitionSection` owns the list, `ArgumentDefinitionRow`
 * the row, and `PluginReferenceMappingsEditor` borrows `.argument-row-subblock`,
 * `.argument-row-nested` and `.argument-row-delete` from the row's sheet.
 *
 * Three shapes recur and are worth naming once:
 *
 *   • **Hover-revealed delete buttons.** Both sheets hid a trash button with
 *     `opacity: 0` and revealed it from the *parent's* `:hover` / `:focus-within`.
 *     That is a `group` on the parent plus `group-hover:` / `group-focus-within:` on
 *     the button — the classes below assume the parent carries `group`.
 *   • **The chevron rotation.** `.argument-row.is-expanded .argument-row-chevron`
 *     becomes a `rotate-90` the row applies itself, since it already knows
 *     `isExpanded`.
 *   • **`--radius-xs` is 6px, which is `rounded-md`, and `--radius-md` is 12px, which
 *     is `rounded-xl`** (spec §3b). Neither keeps its old name.
 *
 * `ArgumentOptionsEditor.css` also declared two custom properties
 * (`--argument-options-action-width: 28px`, `--argument-options-field-gap: 1rem`) used
 * only as spacer widths and one margin, so they inline to `w-7`, `w-4` and `ml-4`.
 */

/* ── the argument list ────────────────────────────────────────────────────── */

/** `.argument-definition-list` */
export const ARGUMENT_LIST_CLASS = 'flex flex-col gap-1.5';

/** `.argument-definition-empty` */
export const ARGUMENT_EMPTY_CLASS = 'rounded-xl border border-dashed border-border px-4 py-5 text-center text-[0.8125rem] text-muted';

/** `.add-argument-button` */
export const ARGUMENT_ADD_BUTTON_CLASS = 'mt-2';

/* ── one argument row ─────────────────────────────────────────────────────── */

/**
 * `.argument-row` had no declarations of its own — it existed only as the ancestor in
 * `:hover`/`:focus-within`/`.is-expanded` selectors, so it becomes a bare `group`.
 */
export const ARGUMENT_ROW_CLASS = 'group';

/** `.argument-row-header` */
export const ARGUMENT_ROW_HEADER_CLASS = 'flex flex-row items-center gap-1.5 rounded-xl py-1 pl-1.5 pr-2';

/** `.argument-row-toggle` */
export const ARGUMENT_ROW_TOGGLE_CLASS = 'inline-flex min-w-0 flex-1 cursor-pointer flex-row items-center gap-2 rounded-md border-none bg-transparent px-1 py-1.5 text-left text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--focus)]';

/** `.argument-row-chevron` */
export const ARGUMENT_ROW_CHEVRON_CLASS = 'shrink-0 text-muted transition-transform duration-150 ease-out';

/** `.argument-row.is-expanded .argument-row-chevron` */
export const ARGUMENT_ROW_CHEVRON_EXPANDED_CLASS = 'rotate-90';

/** `.argument-row-title` */
export const ARGUMENT_ROW_TITLE_CLASS = 'min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis text-[0.8125rem] font-medium';

/** `.argument-row-title--placeholder` */
export const ARGUMENT_ROW_TITLE_PLACEHOLDER_CLASS = 'italic text-muted';

/** `.argument-row-delete` — `--accent-red` is `--danger`. */
export const ARGUMENT_ROW_DELETE_CLASS = 'inline-flex size-7 shrink-0 cursor-pointer flex-row items-center justify-center rounded-md border-none bg-transparent p-0 text-muted opacity-0 transition-[opacity,color,background-color] duration-[120ms] ease-out hover:bg-surface-hover hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--focus)] group-hover:opacity-100 group-focus-within:opacity-100';

/** `.argument-row-body` */
export const ARGUMENT_ROW_BODY_CLASS = 'flex flex-col border-t border-border py-3';

/**
 * `.argument-row-subheading`. Its own `font-size: 0.6875rem` beat the `text-xs` the
 * call sites also carried, so the size is pinned here and `text-xs` is dropped.
 */
export const ARGUMENT_ROW_SUBHEADING_CLASS = 'mt-5 mb-2 ml-1 text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-muted';

/** `.argument-row-subblock` */
export const ARGUMENT_ROW_SUBBLOCK_CLASS = 'p-1';

/** `.argument-row-nested` */
export const ARGUMENT_ROW_NESTED_CLASS = 'mt-2';

/* ── the select-options editor ────────────────────────────────────────────── */

/** `.argument-options-editor` */
export const OPTIONS_EDITOR_CLASS = 'flex flex-col gap-3';

/** `.argument-options-grid` */
export const OPTIONS_GRID_CLASS = 'flex flex-row items-center gap-0 px-1';

/** `.argument-options-grid__header` */
export const OPTIONS_GRID_HEADER_CLASS = 'min-w-0 flex-1 pl-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted';

/** `.argument-options-grid__gap` — `var(--argument-options-field-gap)`, 1rem. */
export const OPTIONS_GRID_GAP_CLASS = 'inline-block w-4 shrink-0';

/** `.argument-options-grid__spacer--action` — `var(--argument-options-action-width)`, 28px. */
export const OPTIONS_GRID_ACTION_SPACER_CLASS = 'inline-block w-7 shrink-0';

/** `.argument-options-list` */
export const OPTIONS_LIST_CLASS = 'm-0 flex list-none flex-col gap-1 p-0';

/** `.argument-options-row` — also the `group` for its own remove button. */
export const OPTIONS_ROW_CLASS = 'group flex flex-row items-center gap-0 rounded-md border border-transparent px-1.5 py-1 transition-[background-color,border-color] duration-[120ms] ease-out hover:bg-surface-hover';

/** `.argument-options-row.has-error` */
export const OPTIONS_ROW_ERROR_CLASS = 'border-danger bg-danger/6';

/**
 * `.argument-options-input`. `--color-bg-subtle` is `--surface-secondary` and
 * `--color-bg` is `--background`, both from the app's own token shim; the `rgba()`
 * fallbacks in the sheet were never reached. Its `:hover` border is omitted, not
 * lost: it named `--color-border`, which resolves to the same `--border` the base
 * border already uses.
 */
export const OPTIONS_INPUT_CLASS = 'min-w-0 flex-1 rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-sm text-foreground outline-none transition-[border-color,background-color] duration-[120ms] ease-out focus:border-accent focus:bg-background';

/** `.argument-options-input.has-error` */
export const OPTIONS_INPUT_ERROR_CLASS = 'border-danger';

/** `.argument-options-row > .argument-options-input--label` */
export const OPTIONS_INPUT_LABEL_OFFSET_CLASS = 'ml-4';

/** `.argument-options-row__remove` + its `margin-left`. */
export const OPTIONS_REMOVE_CLASS = 'ml-2 shrink-0 text-muted opacity-0 transition-[opacity,color] duration-[140ms] ease-out hover:text-danger group-hover:opacity-100 group-focus-within:opacity-100';

/** `.argument-options-footer` */
export const OPTIONS_FOOTER_CLASS = 'flex flex-col gap-2 pt-1';

/** `.argument-options-error-hint` */
export const OPTIONS_ERROR_HINT_CLASS = 'text-xs text-danger';
