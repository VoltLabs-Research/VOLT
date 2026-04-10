import { cn } from '@/shared/utils';
import './StatusBadge.css';
import React from 'react';

export interface StatusBadgeProps{
    /**
     * Status string - will be mapped to variant automatically
     */
    status?: string;

    /**
     * Visual variant override
     */
    variant?: 'active' | 'inactive' | 'danger' | 'neutral' | 'success' | 'warning' | 'brand' | 'primary';

    /**
     * Size variant
     * @default 'default'
     */
    size?: 'default' | 'compact';

    /**
     * Badge content (alternative to status)
     */
    children?: React.ReactNode;

    /**
     * Additional CSS classes
     */
    className?: string;
};

const statusToVariant = (status: string): string => {
    const statusLower = status?.toLowerCase();
    switch(statusLower){
        case 'ready':
        case 'completed':
        case 'success':
        case 'active':
        case 'published':
        case 'healthy':
        case 'online':
        case 'accepted':
        case 'connected':
            return 'success';
        case 'processing':
        case 'queued':
        case 'rendering':
        case 'warning':
        case 'pending':
        case 'waiting-for-process':
        case 'analyzing':
            return 'warning';
        case 'running':
            return 'active';
        case 'failed':
        case 'error':
        case 'danger':
        case 'critical':
        case 'rejected':
            return 'danger';
        case 'inactive':
        case 'draft':
        case 'disabled':
        case 'offline':
        case 'disconnected':
            return 'inactive';
        case 'brand':
            return 'brand';
        case 'primary':
            return 'primary';
        default:
            return 'neutral';
    }
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant, size = 'default', children, className = '' }) => {
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
        <span className={classes}>
            {content}
        </span>
    );
};

export default StatusBadge;
