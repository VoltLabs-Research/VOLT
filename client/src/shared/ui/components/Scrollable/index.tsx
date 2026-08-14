import { ScrollShadow } from '@heroui/react';

import type { ComponentProps, CSSProperties } from 'react';

/*
 * The scroll container for the whole app: a HeroUI ScrollShadow that already carries the two
 * settings this codebase always needs, so no call site has to remember either of them.
 *
 * It exists because scrollbars are hidden globally (see index.css: `scrollbar-width: none` plus
 * `::-webkit-scrollbar { display: none }`). With no bar, a clipped list gives the reader nothing
 * at all — the content simply stops — so the edge fade is the only affordance left, and every
 * scrollable region should have one.
 *
 * ScrollShadow *is* the scroller (`.scroll-shadow--vertical { overflow-y: auto }`), so a caller
 * passes its layout classes and drops its own `overflow-*` class rather than keeping both.
 */

type ScrollShadowProps = ComponentProps<typeof ScrollShadow>;

/*
 * `hideScrollBar` and `variant` are not negotiable, so they are not offered:
 *
 * - The fade is a mask that reserves `--scroll-shadow-scrollbar-size` (10px by default) at full
 *   opacity for the scrollbar. Since ours is hidden, that would leave a sharp 10px strip along
 *   the edge while everything beside it faded. `hideScrollBar` zeroes the reservation.
 * - `fade` is the only variant the library ships.
 */
export type ScrollableProps = Omit<ScrollShadowProps, 'hideScrollBar' | 'variant'>;

/*
 * 24px rather than the library's 40px. Most scrollers here are compact — a 180px popover list, a
 * 240px sidebar panel — where a 40px fade at each edge dissolves a third of the content.
 */
const DEFAULT_SHADOW_SIZE = 24;

const Scrollable = ({ size = DEFAULT_SHADOW_SIZE, style, ...props }: ScrollableProps) => (
    <ScrollShadow
        hideScrollBar
        size={size}
        /*
         * The size is written as the custom property as well, not just passed as `size`: the
         * library spreads `...props` after the style it computes, so a call site that passes any
         * `style` of its own would otherwise drop the variable and silently fall back to 40px.
         */
        style={{
            '--scroll-shadow-size': `${size}px`,
            ...style
        } as CSSProperties}
        {...props}
    />
);

export default Scrollable;
