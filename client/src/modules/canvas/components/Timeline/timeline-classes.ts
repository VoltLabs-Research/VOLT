/**
 * The class vocabulary `Timeline.css` owned, plus the four rules `CanvasPage.css`
 * reached in with (inventory contract #8).
 *
 * Three things are worth knowing before editing any of it.
 *
 * **1. The mobile timeline is a click-through frame.** Under 768px the dock, the header
 * regions and the body all carry `pointer-events-none` so a thumb drags the 3D scene
 * behind them, and only the actual controls re-enable it. That is why
 * `MOBILE_ACTIONS_CLASS` ends in five descendant variants: the original was
 * `.canvas-timeline-mobile-actions :is(button, input, select, [role=button],
 * [data-popover-trigger]) { pointer-events: auto }`, and it has to stay a descendant
 * rule because the controls are HeroUI internals.
 *
 * **2. The whole `--canvas-floating-surface-*` contract is two utilities.** Every
 * consumer of it in this file resolves to `rounded-xl bg-surface-secondary`, and only
 * under 768px — above that breakpoint the `--canvas-floating-surface-active-*`
 * variables were never defined for these selectors, so `background: var(…)` was
 * invalid at computed-value time and painted nothing. The `border` and `box-shadow`
 * arms were `0`, which is not a valid `box-shadow`, so they painted nothing at either
 * size. None of that is carried over.
 *
 * **3. `--accent-blue` is the foreground now.** The playhead and the "running" tick
 * were blue; VOLT collapsed that token onto the monochrome accent long before this
 * migration (spec §3a), so they are `bg-accent` / `text-accent`.
 */

/** `.canvas-timeline`. The height comes from `.canvas-center-timeline > .canvas-timeline`. */
export const TIMELINE_ROOT_CLASS = 'flex min-h-0 flex-col overflow-hidden max-h-[calc(100dvh-2rem)] max-md:gap-2 max-md:items-stretch max-md:overflow-visible max-md:pointer-events-none';

/** `> .canvas-timeline--timeline-active { height: auto }` versus the resizable height. */
export const TIMELINE_HEIGHT_CLASS = 'h-[var(--canvas-timeline-size,12rem)]';
export const TIMELINE_HEIGHT_ACTIVE_CLASS = 'h-auto';

/** `.canvas-timeline-header` — a 40px bar that wraps at 900px and dissolves at 768px. */
export const HEADER_CLASS = 'relative flex w-full flex-row items-center px-2 py-1 h-10 max-[900px]:h-auto max-[900px]:min-h-10 max-[900px]:flex-wrap max-[900px]:gap-2 max-md:contents max-md:h-auto max-md:min-h-0 max-md:p-0';

/** `.canvas-timeline-tabs-region` */
export const TABS_REGION_CLASS = 'flex min-w-0 flex-auto flex-row items-center max-[900px]:flex-[1_1_100%] max-md:pointer-events-none max-md:order-1 max-md:w-full max-md:flex-none max-md:self-stretch';

/**
 * `.canvas-timeline-tabs`. The edge fade is the one rule here with no utility of its
 * own: it is a `mask-image` plus its `-webkit-` twin, written as two arbitrary
 * properties rather than moved to the global sheet, which keeps it at the call site.
 */
export const TABS_CLASS = [
    'flex flex-[0_1_auto] flex-row flex-nowrap items-center overflow-x-auto overflow-y-hidden whitespace-nowrap',
    'max-w-[min(55vw,500px)] max-[900px]:max-w-full max-md:hidden [&>*]:shrink-0',
    '[mask-image:linear-gradient(to_right,transparent_0,black_14px,black_calc(100%_-_14px),transparent_100%)]',
    '[-webkit-mask-image:linear-gradient(to_right,transparent_0,black_14px,black_calc(100%_-_14px),transparent_100%)]'
].join(' ');

/** `.canvas-timeline-tab-select-region` — the tab list becomes a Select under 768px. */
export const TAB_SELECT_REGION_CLASS = 'hidden max-md:block max-md:overflow-hidden max-md:rounded-xl max-md:bg-surface-secondary max-md:pointer-events-auto';

/** `.canvas-timeline-tab-select` — inherits the region's radius and fill. */
export const TAB_SELECT_TRIGGER_CLASS = 'max-md:pointer-events-auto max-md:h-auto max-md:min-h-[1.875rem] max-md:w-full max-md:rounded-[inherit] max-md:border-transparent max-md:bg-inherit max-md:px-2 max-md:py-1 max-md:text-[0.6875rem]';

/** `.canvas-timeline-mobile-actions` — `display: contents` until it becomes the row. */
export const MOBILE_ACTIONS_CLASS = [
    'contents max-md:order-3 max-md:flex max-md:w-full max-md:flex-none max-md:items-center max-md:justify-between max-md:gap-2 max-md:self-stretch max-md:pointer-events-none',
    'max-md:[&_button]:pointer-events-auto max-md:[&_input]:pointer-events-auto max-md:[&_select]:pointer-events-auto',
    'max-md:[&_[role=button]]:pointer-events-auto max-md:[&_[data-popover-trigger]]:pointer-events-auto'
].join(' ');

/** `.canvas-timeline-controls-region` — absolutely centred, then a static row. */
export const CONTROLS_REGION_CLASS = [
    'pointer-events-none absolute left-1/2 top-1/2 z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-row items-center justify-center px-1.5',
    'max-[900px]:static max-[900px]:order-3 max-[900px]:w-full max-[900px]:transform-none max-[900px]:justify-center max-[900px]:p-0',
    'max-md:w-auto max-md:flex-none max-md:justify-start max-md:rounded-xl max-md:border-0 max-md:bg-surface-secondary'
].join(' ');

/** `.canvas-timeline-controls-center` */
export const CONTROLS_CENTER_CLASS = 'pointer-events-auto flex w-max flex-row items-center justify-center max-[900px]:w-full max-md:contents max-md:w-auto';

/** `.canvas-timeline-frame-region` */
export const FRAME_REGION_CLASS = 'flex min-w-0 flex-auto flex-row items-center justify-end max-[900px]:flex-[1_1_100%] max-[900px]:justify-start max-md:pointer-events-none max-md:w-auto max-md:flex-none max-md:justify-start';

/** `.canvas-timeline-frame-info` */
export const FRAME_INFO_CLASS = 'flex min-w-0 flex-[0_1_auto] flex-row items-center justify-end gap-2 max-[900px]:flex-wrap max-[900px]:justify-start max-md:pointer-events-none max-md:flex-nowrap max-md:gap-1 max-md:overflow-hidden';

/**
 * `.canvas-timeline-frame-info .button.size-sm` plus the floating surface it picked up
 * under 768px. Worn by the two `PresetPopover` triggers.
 */
export const FRAME_INFO_BUTTON_CLASS = 'max-md:h-[1.875rem] max-md:min-h-[1.875rem] max-md:rounded-xl max-md:bg-surface-secondary max-md:px-2 max-md:text-[0.6875rem]';

/**
 * `.canvas-timeline-frame-info .form-field-canvas-input--compact` plus the same
 * surface. Worn by the two `FrameCombobox` groups.
 */
export const FRAME_INFO_COMPACT_INPUT_CLASS = 'max-md:h-[1.875rem] max-md:min-h-[1.875rem] max-md:w-[clamp(3.25rem,17vw,4.5rem)] max-md:rounded-xl max-md:bg-surface-secondary max-md:text-[0.625rem]';

/**
 * `.canvas-timeline-ruler-region`. The `--timeline-active` height is unconditional
 * here: the region is only rendered on the timeline tab, which is exactly when that
 * flag was set.
 */
export const RULER_REGION_CLASS = 'relative h-[25px] min-h-[25px] flex-none max-md:pointer-events-auto max-md:order-2 max-md:h-8 max-md:min-h-8 max-md:min-w-0 max-md:self-stretch max-md:overflow-auto';

/** `.canvas-timeline-body` inside the ruler region — kept transparent under 768px. */
export const RULER_BODY_CLASS = 'relative h-full min-h-0 flex-auto';

/**
 * `.canvas-timeline > .canvas-timeline-body` — the tab bodies. Only rendered off the
 * timeline tab, which is why `pointer-events` is `auto` rather than the `:not()` the
 * stylesheet needed.
 */
export const TAB_BODY_CLASS = 'relative h-full min-h-0 flex-auto overflow-hidden max-md:pointer-events-auto max-md:order-2 max-md:h-auto max-md:min-h-0 max-md:min-w-0 max-md:flex-1 max-md:self-stretch max-md:overflow-auto max-md:rounded-xl max-md:border-0 max-md:bg-surface-secondary';

/** `.canvas-timeline-ruler` */
export const RULER_CLASS = 'flex h-full min-h-[22px] touch-pan-y items-end select-none overflow-x-auto overflow-y-hidden border-b border-border outline-none max-md:touch-none';

/** `.canvas-playhead` / `.canvas-playhead-head` */
export const PLAYHEAD_CLASS = 'pointer-events-none absolute inset-y-0 z-[2] w-0.5 bg-accent';
export const PLAYHEAD_HEAD_CLASS = 'absolute -left-1 -top-1 size-2.5 rounded-full bg-accent';

/** `.canvas-ruler-tick` and its dimmed state. */
export const TICK_CLASS = 'flex h-full shrink-0 cursor-pointer flex-col items-center px-3 max-md:px-2';
export const TICK_DIMMED_CLASS = 'opacity-35 transition-opacity duration-[180ms] ease-out';

/** `.canvas-ruler-tick-label` / `-mark`, with the light-theme ink overrides. */
export const TICK_LABEL_CLASS = 'whitespace-nowrap text-xs leading-none text-muted transition-[color,text-shadow] duration-[180ms] max-md:text-[0.625rem]';
export const TICK_MARK_CLASS = 'w-px bg-border transition-[background-color,box-shadow] duration-[180ms]';
export const TICK_MARK_MINOR_CLASS = 'h-1.5 max-md:h-1';
export const TICK_MARK_MAJOR_CLASS = 'h-2.5 bg-muted max-md:h-[7px]';

export const TICK_LABEL_TONE_CLASS = {
    queued: 'text-warning [[data-theme=light]_&]:text-[#8a5300]',
    running: 'text-accent [[data-theme=light]_&]:text-[#0a5fbf]',
    completed: 'text-success [text-shadow:0_0_10px_color-mix(in_srgb,var(--success)_35%,transparent)] [[data-theme=light]_&]:text-[#0f7a34] [[data-theme=light]_&]:[text-shadow:0_0_10px_color-mix(in_srgb,#0f7a34_25%,transparent)]'
} as const;

export const TICK_MARK_TONE_CLASS = {
    queued: 'bg-warning',
    running: 'bg-accent',
    completed: 'bg-success shadow-[0_0_8px_color-mix(in_srgb,var(--success)_35%,transparent)]'
} as const;
