import React from 'react';
import { cn } from '@/shared/utils';
import './StatusBadge.css';

export interface StatusBadgeProps{
    /**
     * Status string - will be mapped to variant automatically
     */
    status?: string;

    /**
     * Visual variant override
     */
    variant?: 'active' | 'inactive' | 'danger' | 'neutral' | 'success' | 'warning';

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
            return 'success';
        case 'processing':
        case 'queued':
        case 'rendering':
        case 'warning':
        case 'pending':
            return 'warning';
        case 'failed':
        case 'error':
        case 'danger':
            return 'danger';
        case 'inactive':
        case 'draft':
            return 'inactive';
        default:
            return 'neutral';
    }
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant, children, className = '' }) => {
    const computedVariant = variant ?? (status ? statusToVariant(status) : 'neutral');
    const content = children ?? status;

    const classes = cn(
        'status-badge',
        'radius-full',
        `variant-${computedVariant}`,
        'gap-025',
        'p-05',
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
