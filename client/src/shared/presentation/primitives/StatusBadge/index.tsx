import { cn } from '@/shared/utils/cn';
import './StatusBadge.css';
import { forwardRef } from 'react';
import type { ReactNode } from 'react';

type StatusBadgeVariant = 'active' | 'inactive' | 'danger' | 'neutral' | 'success' | 'warning' | 'brand' | 'primary';

export interface StatusBadgeProps{
    /**
     * Status string - will be mapped to variant automatically
     */
    status?: string;

    /**
     * Visual variant override
     */
    variant?: StatusBadgeVariant;

    /**
     * Size variant
     * @default 'default'
     */
    size?: 'default' | 'compact';

    /**
     * Badge content (alternative to status)
     */
    children?: ReactNode;

    /**
     * Additional CSS classes
     */
    className?: string;
};

const STATUS_VARIANTS: Record<string, StatusBadgeVariant> = {
    ready: 'success',
    completed: 'success',
    success: 'success',
    active: 'success',
    published: 'success',
    healthy: 'success',
    online: 'success',
    accepted: 'success',
    connected: 'success',
    processing: 'warning',
    queued: 'warning',
    rendering: 'warning',
    warning: 'warning',
    pending: 'warning',
    'waiting-for-process': 'warning',
    analyzing: 'warning',
    running: 'active',
    failed: 'danger',
    error: 'danger',
    danger: 'danger',
    critical: 'danger',
    rejected: 'danger',
    inactive: 'inactive',
    draft: 'inactive',
    disabled: 'inactive',
    offline: 'inactive',
    disconnected: 'inactive',
    brand: 'brand',
    primary: 'primary'
};

const statusToVariant = (status: string): StatusBadgeVariant => {
    return STATUS_VARIANTS[status.toLowerCase()] ?? 'neutral';
};

const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(({ status, variant, size = 'default', children, className = '' }, ref) => {
    const computedVariant = variant ?? (status ? statusToVariant(status) : 'neutral');
    const content = children ?? status;

    const classes = cn(
        'status-badge',
        'radius-full',
        `variant-${computedVariant}`,
        size !== 'default' && `size-${size}`,
        'gap-025',
        'font-size-1',
        'font-weight-5',
        className
    );

    return (
        <span ref={ref} className={classes}>
            {content}
        </span>
    );
});

StatusBadge.displayName = 'StatusBadge';

export default StatusBadge;
