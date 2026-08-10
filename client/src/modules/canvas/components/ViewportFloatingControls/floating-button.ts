/**
 * `.canvas-viewport-floating-btn`, which every control in the viewport's floating
 * column wore — the four compact menu popovers, the Volt AI button and the theme
 * toggle.
 *
 * The twelve `!important`s the stylesheet needed are gone: they existed only to beat
 * bravais's own `.button.size-sm` metrics from a plain stylesheet, and HeroUI
 * declares `@layer theme, base, components, utilities`, so a utility written here
 * already outranks anything in `.button--sm`.
 *
 * The colour pair used to arrive through
 * `.canvas-viewport-floating-controls .canvas-viewport-floating-btn`; it is folded in
 * here instead of becoming an ancestor variant because that column is the only place
 * these controls are ever rendered.
 */
export const VIEWPORT_FLOATING_BUTTON_CLASS = 'size-[30px] min-h-[30px] min-w-[30px] rounded-full p-0 text-muted hover:text-foreground focus-visible:text-foreground max-md:size-[34px] max-md:min-h-[34px] max-md:min-w-[34px]';
