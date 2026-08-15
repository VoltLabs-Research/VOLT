import { ScrollShadow } from '@heroui/react';

import type { ComponentProps, CSSProperties } from 'react';

type ScrollShadowProps = ComponentProps<typeof ScrollShadow>;

export type ScrollableProps = Omit<ScrollShadowProps, 'hideScrollBar' | 'variant'>;

const DEFAULT_SHADOW_SIZE = 24;

const Scrollable = ({ size = DEFAULT_SHADOW_SIZE, style, ...props }: ScrollableProps) => (
    <ScrollShadow
        hideScrollBar
        size={size}
        style={{
            '--scroll-shadow-size': `${size}px`,
            ...style
        } as CSSProperties}
        {...props}
    />
);

export default Scrollable;
