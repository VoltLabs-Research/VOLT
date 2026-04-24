/**
 * Shared design tokens for Volt primitives.
 *
 * These tokens map 1:1 to utility classes already declared in
 * `src/shared/presentation/assets/stylesheets/general.css` and `base.css`.
 * Primitives MUST NOT emit classes whose CSS definitions don't exist.
 */

export type Display = 'flex' | 'block' | 'none';

export type FlexDirection = 'row' | 'column' | 'row-reverse';

export type AlignItems = 'start' | 'center' | 'end';

export type JustifyContent = 'start' | 'center' | 'end' | 'between' | 'around';

export type GapToken =
    | '01' | '02' | '025' | '035' | '05' | '075'
    | '1' | '1-5' | '2' | '3';

export type PaddingToken = '0' | '025' | '05' | '075' | '1' | '1-5' | '2' | '3';

export type PaddingXToken = '1';

export type MarginTopToken = '05' | '1' | '3';

export type MarginBottomToken = '1-5' | '3';

export type MarginXToken = 'auto';

export type RadiusToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export type BorderToken = 'soft' | 'none' | 'bottom-soft' | 'top-soft';

export type PositionToken = 'relative' | 'sticky' | 'absolute' | 'fixed';

export type OverflowToken =
    | 'auto' | 'hidden'
    | 'x-auto' | 'x-scroll'
    | 'y-auto' | 'y-scroll';

export type WidthToken = 'max' | '50' | 'vw-max';

export type HeightToken = 'max' | 'vh-max';

export type FlexToken = '1';

export type TransitionToken = 'fast' | 'normal';

/**
 * Typography tokens. These match `font-size-*` / `font-weight-*` / `color-*`
 * utilities declared in `general.css`.
 */
export type TextSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export type TextTone = 'primary' | 'secondary' | 'muted' | 'muted-foreground';

export type TextAlign = 'left' | 'center' | 'right';

export type SurfaceVariant =
    | 'primary'   // primary-surface
    | 'glass'     // glass-bg
    | 'elevated'  // card-elevated
    | 'danger'    // zone-danger
    | 'warning';  // zone-warning
