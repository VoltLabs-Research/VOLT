import { cn } from '@/shared/utils/cn';
import './Skeleton.css';
import { forwardRef } from 'react';
import type { CSSProperties } from 'react';

export type SkeletonVariant = 'text' | 'rectangular' | 'rounded' | 'circular';
export type SkeletonAnimation = 'wave' | 'pulse' | 'none';

export interface SkeletonProps {
    variant?: SkeletonVariant;
    animation?: SkeletonAnimation;
    width?: string | number;
    height?: string | number;
    className?: string;
    style?: CSSProperties;
};

const toCssSize = (value: string | number | undefined): string | undefined => {
    if (value === undefined) return undefined;
    if (typeof value === 'number') return `${value}px`;
    return value;
};

const Skeleton = forwardRef<HTMLSpanElement, SkeletonProps>(({
    variant = 'text',
    animation = 'pulse',
    width,
    height,
    className = '',
    style
}, ref) => {
    const classes = cn(
        'volt-skeleton',
        `volt-skeleton--${variant}`,
        `volt-skeleton--${animation}`,
        className
    );

    const resolvedStyle: CSSProperties = {
        ...style,
        width: toCssSize(width) ?? style?.width,
        height: toCssSize(height) ?? style?.height
    };

    return (
        <span
            ref={ref}
            className={classes}
            style={resolvedStyle}
            aria-hidden='true'
            data-variant={variant}
            data-animation={animation}
        />
    );
});

Skeleton.displayName = 'Skeleton';

export default Skeleton;
