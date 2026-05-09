import { cn } from '@/shared/utils/cn';
import './Tag.css';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

export type TagTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
export type TagSize = 'xs' | 'sm' | 'md';
export type TagVariant = 'soft' | 'solid' | 'outline';
export type TagShape = 'pill' | 'square';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
    tone?: TagTone;
    size?: TagSize;
    variant?: TagVariant;
    shape?: TagShape;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    children?: ReactNode;
}

const Tag = forwardRef<HTMLSpanElement, TagProps>(({
    tone = 'neutral',
    size = 'sm',
    variant = 'soft',
    shape = 'pill',
    leftIcon,
    rightIcon,
    className,
    children,
    ...rest
}, ref) => {
    const classes = cn(
        'volt-tag',
        `volt-tag--tone-${tone}`,
        `volt-tag--size-${size}`,
        `volt-tag--variant-${variant}`,
        `volt-tag--shape-${shape}`,
        className
    );

    return (
        <span ref={ref} className={classes} {...rest}>
            {leftIcon && <span className='volt-tag__icon' aria-hidden='true'>{leftIcon}</span>}
            <span className='volt-tag__label'>{children}</span>
            {rightIcon && <span className='volt-tag__icon' aria-hidden='true'>{rightIcon}</span>}
        </span>
    );
});

Tag.displayName = 'Tag';

export default Tag;
