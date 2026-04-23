import { cn } from '@/shared/utils';
import './StatusDot.css';

export type StatusDotTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

interface StatusDotProps {
    /** @deprecated use `tone` */
    isOnline?: boolean;
    /**
     * Color tone. When omitted, falls back to `isOnline` → `success | neutral`.
     */
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
    isOnline,
    tone,
    size = 'sm',
    className = '',
    label,
    pulse = false,
    glow = false
}: StatusDotProps) => {
    const resolvedTone: StatusDotTone = tone ?? (isOnline === false ? 'neutral' : isOnline ? 'success' : 'neutral');

    const classes = cn(
        'status-dot',
        'radius-full',
        'f-shrink-0',
        `size-${size}`,
        `status-dot--tone-${resolvedTone}`,
        // Legacy classes for backwards compatibility
        typeof isOnline === 'boolean' && (isOnline ? 'online' : 'offline'),
        pulse && 'status-dot--pulse',
        glow && 'status-dot--glow',
        className
    );

    return (
        <span
            className={classes}
            role='status'
            aria-label={label ?? `${resolvedTone} status`}
        />
    );
};

export default StatusDot;
