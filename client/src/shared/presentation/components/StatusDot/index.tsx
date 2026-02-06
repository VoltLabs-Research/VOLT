import React from 'react';
import { cn } from '@/shared/utils';
import './StatusDot.css';

interface StatusDotProps{
    isOnline: boolean;
    size?: 'sm' | 'md';
    className?: string;
};

const StatusDot: React.FC<StatusDotProps> = ({
    isOnline,
    size = 'sm',
    className = ''
}) => {
    const classes = cn(
        'status-dot',
        'radius-full',
        'f-shrink-0',
        `size-${size}`,
        isOnline ? 'online' : 'offline',
        className
    );

    return <span className={classes} />;
};

export default StatusDot;
