import { cn } from '@/shared/utils';
import { forwardRef } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';

export interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'aria-valuenow' | 'aria-valuemin' | 'aria-valuemax'> {
    value?: number;
    max?: number;
    label?: string;
    indeterminate?: boolean;
}

interface ProgressFillStyle extends CSSProperties {
    width: string;
}

const Progress = forwardRef<HTMLDivElement, ProgressBarProps>(({
    value = 0,
    max = 100,
    label,
    indeterminate = false,
    className,
    ...rest
}, ref) => {
    const clamped = Math.max(0, Math.min(value, max));
    const percentage = max > 0 ? (clamped / max) * 100 : 0;

    const trackStyle: CSSProperties = {
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border-soft)',
        height: 6,
        width: '100%'
    };

    const fillStyle: ProgressFillStyle = {
        width: indeterminate ? '40%' : `${percentage}%`,
        height: '100%',
        background: 'var(--color-brand-primary, var(--accent-blue))',
        transition: 'width 0.2s ease'
    };

    const classes = cn('radius-full', className);

    return (
        <div
            ref={ref}
            role='progressbar'
            aria-valuenow={indeterminate ? undefined : clamped}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-label={label}
            className={classes}
            style={trackStyle}
            {...rest}
        >
            <div style={fillStyle} />
        </div>
    );
});

Progress.displayName = 'ProgressBar';

export default Progress;
