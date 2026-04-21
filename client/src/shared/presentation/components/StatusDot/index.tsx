import { cn } from '@/shared/utils';
import './StatusDot.css';

interface StatusDotProps{
    isOnline: boolean;
    size?: 'sm' | 'md';
    className?: string;
    label?: string;
};

const StatusDot = ({
    isOnline,
    size = 'sm',
    className = '',
    label
}: StatusDotProps) => {
    const classes = cn(
        'status-dot',
        'radius-full',
        'f-shrink-0',
        `size-${size}`,
        isOnline ? 'online' : 'offline',
        className
    );

    return <span className={classes} role='status' aria-label={label ?? (isOnline ? 'Online' : 'Offline')} />;
};

export default StatusDot;
