/**
 * The class vocabulary that `FormField.css` and `FormSection.css` used to own.
 *
 * Every value here is a complete static literal so Tailwind's scanner can see it
 * — nothing is interpolated. The three surfaces are the three ways an inline
 * field was painted before:
 *
 *   inline   `.form-field-inline*` — a 140px label column beside the control
 *   section  `.form-section-group .form-field-inline*` — the same field
 *            flattened into a bordered settings row. This used to arrive through
 *            a descendant selector in `FormSection.css`; it now arrives through
 *            `useIsInFormSectionGroup()`, which is strictly equivalent (React
 *            nesting instead of DOM nesting) for every call site, all of which
 *            render their fields inside the group element.
 *   canvas   `.form-field-canvas*` — the 24px-tall compact canvas language
 *
 * Two families of rules were dropped rather than translated, because the app's
 * single stylesheet already owns them globally:
 *
 *   - the `:focus-visible` box-shadow rings. `index.css` rings every plain
 *     control with `outline: 2px solid var(--focus)`, and HeroUI's own parts ring
 *     themselves through `status-focused-field`.
 *   - the `@media (prefers-reduced-motion: reduce)` transition opt-out, which
 *     `index.css` declares for the whole document.
 *
 * A note on why utilities are enough to restyle HeroUI's own parts: HeroUI
 * declares `@layer theme, base, components, utilities`, so every utility written
 * here outranks anything in `.select__trigger` regardless of specificity — which
 * is what lets `bg-transparent` beat `.select__trigger:hover { @apply bg-field-hover }`.
 */

export type FieldSurface = 'inline' | 'section' | 'canvas';

/** `.form-field-inline` / `.form-section-group .form-field-inline` / `.form-field-canvas` */
const CONTAINER_CLASS: Record<FieldSurface, string> = {
    inline: 'grid grid-cols-[140px_1fr] items-center gap-3 min-h-[2.375rem]',
    section: 'grid grid-cols-[minmax(88px,40%)_1fr] items-center gap-3 px-3.5 py-2 min-h-10 border-b border-border last:border-b-0',
    canvas: 'flex flex-row items-center justify-between gap-2 min-h-6'
};

/** `.form-field-inline.form-field-inline-no-label` collapses the label column away. */
const CONTAINER_NO_LABEL_CLASS: Record<FieldSurface, string> = {
    inline: 'grid grid-cols-[1fr] items-center gap-3 min-h-[2.375rem]',
    section: 'grid grid-cols-[1fr] items-center gap-3 px-3.5 py-2 min-h-10 border-b border-border last:border-b-0',
    canvas: 'flex flex-row items-center justify-between gap-2 min-h-6'
};

/** `.form-field-inline.is-loading` */
export const CONTAINER_LOADING_CLASS = 'opacity-70 pointer-events-none';

/** `.form-field-inline-label` / `.canvas-form-label` */
const LABEL_CLASS: Record<FieldSurface, string> = {
    inline: 'shrink-0 text-[0.95rem] font-normal',
    section: 'shrink-0 text-[0.8125rem] font-normal text-foreground',
    canvas: 'min-w-[130px] shrink-0 text-[0.7rem] text-muted whitespace-nowrap overflow-hidden text-ellipsis leading-6 tracking-[0.01em]'
};

/** `.form-field-canvas.checkbox-container .canvas-form-label` lets the label take the row. */
const CHECKBOX_LABEL_CLASS: Record<FieldSurface, string> = {
    inline: 'shrink-0 text-[0.95rem] font-normal',
    section: 'shrink-0 text-[0.8125rem] font-normal text-foreground',
    canvas: 'w-auto min-w-0 flex-1 text-[0.7rem] text-muted whitespace-nowrap overflow-hidden text-ellipsis leading-6 tracking-[0.01em]'
};

/** `.render-input-container`, plus the per-surface `min-width` / `max-width` clamps. */
const CONTROL_SLOT_CLASS: Record<FieldSurface, string> = {
    inline: 'flex items-center justify-end relative w-full min-w-0',
    section: 'flex items-center justify-end relative w-full min-w-0',
    canvas: 'flex items-center justify-end relative w-full min-w-0 max-w-[150px]'
};

/** `.form-field-inline-input` / `.form-field-canvas-input` */
const TEXT_CONTROL_CLASS: Record<FieldSurface, string> = {
    inline: 'flex-1 min-w-0 px-3 py-[0.4375rem] border border-border rounded-lg bg-transparent text-foreground text-sm placeholder:text-muted focus:border-accent',
    section: 'flex-1 min-w-0 px-0 py-1 border-0 bg-transparent text-muted text-sm text-right tabular-nums placeholder:text-muted placeholder:text-right focus:text-foreground',
    canvas: 'flex-1 min-w-0 h-6 px-[0.4rem] border border-border rounded-lg bg-transparent text-foreground text-[0.7rem] transition-colors duration-150 ease-out hover:border-border-secondary focus:border-accent placeholder:text-muted placeholder:text-[0.7rem]'
};

/** `.form-field-inline-textarea` / `.form-field-canvas-textarea` */
const TEXTAREA_CONTROL_CLASS: Record<FieldSurface, string> = {
    inline: 'flex-1 min-w-0 px-3 py-[0.4375rem] border border-border rounded-lg bg-transparent text-foreground text-sm placeholder:text-muted focus:border-accent resize-y min-h-20',
    section: 'flex-1 min-w-0 px-0 py-1 border-0 bg-transparent text-muted text-sm text-left tabular-nums placeholder:text-muted placeholder:text-left focus:text-foreground resize-y min-h-20',
    canvas: 'flex-1 min-w-0 px-[0.4rem] border border-border rounded-lg bg-transparent text-foreground text-[0.7rem] transition-colors duration-150 ease-out hover:border-border-secondary focus:border-accent placeholder:text-muted placeholder:text-[0.7rem] resize-y min-h-[60px]'
};

/**
 * HeroUI's `Select` root is a `flex flex-col` div, so it — not the trigger — is
 * the flex item of `.render-input-container`. bravais's `Select` put `className`
 * straight on its trigger, which is why `.form-field-inline-select`'s
 * `flex: 1; min-width: 0` lived there; here the same two declarations have to
 * move up one level or the trigger would grow along the *column* axis instead.
 */
export const SELECT_ROOT_CLASS = 'flex-1 min-w-0';

/**
 * What `.form-field-inline-select`, `.form-section-group .form-field-inline
 * .select-trigger` and `.form-field-canvas .select-trigger` reached into
 * bravais's trigger to do, re-expressed on HeroUI's own trigger.
 *
 * `pe-6` / `pe-7` is not decoration: HeroUI positions `Select.Indicator`
 * absolutely at `end-2` with `size-4`, so the value needs 24px of inline-end room
 * or the chevron sits on top of the text. HeroUI's own `pe-7` comes from a
 * `:has()` rule in its `components` layer, which any `px-*`/`p-*` utility here
 * outranks — so it has to be restated.
 */
const SELECT_TRIGGER_CLASS: Record<FieldSurface, string> = {
    inline: 'w-full min-h-0 px-3 py-[0.4375rem] pe-7 border border-border rounded-lg bg-transparent text-foreground',
    section: 'w-full h-auto min-h-0 p-0 pe-6 border-0 bg-transparent shadow-none text-muted hover:text-foreground',
    canvas: 'w-full h-6 min-h-6 py-0 ps-[0.4rem] pe-6 border border-border rounded-lg bg-transparent text-foreground transition-colors duration-150 ease-out hover:border-border-secondary'
};

/**
 * `.select__value` pins its own `text-base sm:text-sm` and `text-start`, so the
 * font size and the `text-align: right` that used to reach bravais's trigger
 * label have to be restated on the value slot itself.
 */
const SELECT_VALUE_CLASS: Record<FieldSurface, string> = {
    inline: 'text-sm',
    section: 'text-sm text-end tabular-nums',
    canvas: 'text-[0.7rem]'
};

/** `.form-field-canvas .liquid-toggle` shrank the 78x30 toggle to 36x18. */
const TOGGLE_SIZE: Record<FieldSurface, 'sm' | 'md'> = {
    inline: 'md',
    section: 'md',
    canvas: 'sm'
};

/** `.form-field-autocomplete-menu` */
export const AUTOCOMPLETE_MENU_CLASS = 'flex flex-col max-h-[180px] overflow-y-auto border border-border rounded-lg bg-surface-secondary shadow-[0_8px_24px_rgba(0,0,0,0.25)] z-[99999]';

/** `.form-field-autocomplete-option` */
export const AUTOCOMPLETE_OPTION_CLASS = 'w-full flex flex-col items-start gap-0.5 min-h-10 px-2 py-[0.4375rem] border-0 bg-transparent text-foreground text-left cursor-pointer hover:bg-surface-hover';

/** `.form-field-autocomplete-option.is-active` */
export const AUTOCOMPLETE_OPTION_ACTIVE_CLASS = 'bg-surface-hover';

/** `.form-field-autocomplete-option-label` */
export const AUTOCOMPLETE_OPTION_LABEL_CLASS = 'text-xs leading-[1.2]';

/** `.form-field-autocomplete-option-value` */
export const AUTOCOMPLETE_OPTION_VALUE_CLASS = 'text-[0.65rem] leading-[1.1] text-muted';

/** `.form-field-error` — bravais's `--status-error` is HeroUI's `--danger`. */
export const FIELD_ERROR_CLASS = 'flex items-center gap-1 text-danger text-xs';

/** `.form-field-container` */
export const STACKED_CONTAINER_CLASS = 'flex flex-col gap-2 w-full transition-opacity duration-150 ease-out';

/**
 * The stacked renderer's own label. `text-sm` meant 0.75rem under bravais's
 * `--text-sm`; stock Tailwind's 0.75rem is `text-xs` (spec §3c).
 */
export const STACKED_LABEL_CLASS = 'text-xs font-medium text-muted';

export const resolveFieldSurface = (variant: 'default' | 'inline' | 'canvas', isInFormSectionGroup: boolean): FieldSurface => {
    if (variant === 'canvas') {
        return 'canvas';
    }

    return isInFormSectionGroup ? 'section' : 'inline';
};

interface FieldSurfaceClasses {
    container: string;
    label: string;
    controlSlot: string;
    textControl: string;
    textareaControl: string;
    selectTrigger: string;
    selectValue: string;
    toggleSize: 'sm' | 'md';
};

export const resolveFieldSurfaceClasses = (
    surface: FieldSurface,
    fieldType: 'input' | 'select' | 'checkbox' | 'textarea' | 'color',
    hasLabel: boolean
): FieldSurfaceClasses => {
    const isCheckbox = fieldType === 'checkbox';
    const collapsesLabelColumn = !isCheckbox && surface !== 'canvas' && !hasLabel;

    return {
        container: collapsesLabelColumn ? CONTAINER_NO_LABEL_CLASS[surface] : CONTAINER_CLASS[surface],
        label: isCheckbox ? CHECKBOX_LABEL_CLASS[surface] : LABEL_CLASS[surface],
        controlSlot: CONTROL_SLOT_CLASS[surface],
        textControl: TEXT_CONTROL_CLASS[surface],
        textareaControl: TEXTAREA_CONTROL_CLASS[surface],
        selectTrigger: SELECT_TRIGGER_CLASS[surface],
        selectValue: SELECT_VALUE_CLASS[surface],
        toggleSize: TOGGLE_SIZE[surface]
    };
};
