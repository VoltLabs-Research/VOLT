import React from 'react';
import './StatusBadge.css';

export interface StatusBadgeProps{
    /**
     * Visual variant of the badge
     * @default 'neutral'
     */
    variant?: 'active' | 'inactive' | 'danger' | 'neutral' | 'success';

    /**
     * Badge content
     */
    children: React.ReactNode;

    /**
     * Additional CSS classes
     */
    className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
    variant = 'neutral',
    children,
    className = ''
}) => {
    const classes = [
        'status-badge',
        `variant-${variant}`,
        'gap-025',
        'p-05',
        'font-size-1',
        'font-weight-5',
        className
    ].filter(Boolean).join(' ');

    return (
        <span className={classes}>
            {children}
        </span>
    );
};

export default StatusBadge;
