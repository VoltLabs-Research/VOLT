import { cn } from '@/shared/utils/cn';
import './FloatingToolbar.css';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

export type FloatingToolbarPlacement = 'top' | 'bottom';
export type FloatingToolbarAlign = 'start' | 'center' | 'end';

export interface FloatingToolbarProps extends HTMLAttributes<HTMLDivElement> {
    placement?: FloatingToolbarPlacement;
    align?: FloatingToolbarAlign;
    /** Offset distance (rem) from the edge the toolbar is anchored to. */
    offset?: number;
    children?: ReactNode;
}

/**
 * Centered floating pill toolbar (glass-bg) used over canvases/viewports.
 * Positions itself absolute relative to its nearest positioned ancestor.
 */
const FloatingToolbar = forwardRef<HTMLDivElement, FloatingToolbarProps>(({
    placement = 'top',
    align = 'center',
    offset = 1,
    className,
    style,
    children,
    role = 'toolbar',
    ...rest
}, ref) => {
    const classes = cn(
        'volt-floating-toolbar',
        `volt-floating-toolbar--${placement}`,
        `volt-floating-toolbar--align-${align}`,
        'glass-bg',
        className
    );

    const anchorStyle: React.CSSProperties = {
        ...style,
        [placement]: `${offset}rem`
    };

    return (
        <div ref={ref} role={role} className={classes} style={anchorStyle} {...rest}>
            {children}
        </div>
    );
});

FloatingToolbar.displayName = 'FloatingToolbar';

export default FloatingToolbar;
