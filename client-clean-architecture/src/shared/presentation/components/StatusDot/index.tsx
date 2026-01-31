import React from 'react';
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
    const classes = [
        'status-dot',
        `size-${size}`,
        isOnline ? 'online' : 'offline',
        className
    ].filter(Boolean).join(' ');

    return <span className={classes} />;
};

export default StatusDot;
