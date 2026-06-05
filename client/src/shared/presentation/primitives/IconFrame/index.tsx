import { cn } from '@/shared/utils/cn';
import './IconFrame.css';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

export type IconFrameSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type IconFrameTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
export type IconFrameShape = 'square' | 'circle';

export interface IconFrameProps extends HTMLAttributes<HTMLDivElement> {
    size?: IconFrameSize;
    tone?: IconFrameTone;
    shape?: IconFrameShape;
    children?: ReactNode;
}

/**
 * Tinted rounded container for a decorative icon. Unifies the
 * ~5 hand-rolled "icon bubbles" scattered across dashboards, tiles and menus.
 */
const IconFrame = forwardRef<HTMLDivElement, IconFrameProps>(({
    size = 'md',
    tone = 'neutral',
    shape = 'square',
    className,
    children,
    ...rest
}, ref) => {
    const classes = cn(
        'volt-icon-frame',
        `volt-icon-frame--size-${size}`,
        `volt-icon-frame--tone-${tone}`,
        `volt-icon-frame--shape-${shape}`,
        className
    );

    return (
        <div ref={ref} className={classes} aria-hidden='true' {...rest}>
            {children}
        </div>
    );
});

IconFrame.displayName = 'IconFrame';

export default IconFrame;
