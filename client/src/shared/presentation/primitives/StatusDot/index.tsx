import { cn } from '@/shared/utils/cn';
import './StatusDot.css';

export type StatusDotTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

interface StatusDotProps {
    tone?: StatusDotTone;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    label?: string;
    /** Animates the dot with a gentle pulse. */
    pulse?: boolean;
    /** Adds a soft glow halo (same color as the dot). */
    glow?: boolean;
};

const StatusDot = ({
    tone = 'neutral',
    size = 'sm',
    className = '',
    label,
    pulse = false,
    glow = false
}: StatusDotProps) => {
    const classes = cn(
        'status-dot',
        'radius-full',
        'f-shrink-0',
        `size-${size}`,
        `status-dot--tone-${tone}`,
        pulse && 'status-dot--pulse',
        glow && 'status-dot--glow',
        className
    );

    return (
        <span
            className={classes}
            role='status'
            aria-label={label ?? `${tone} status`}
        />
    );
};

export default StatusDot;
