import { cn } from '@heroui/react';

type StatusTone = 'success' | 'working' | 'warning' | 'danger' | 'default';

// The mockup's status badge: a soft fill in the tone, with a dot. Work in progress is neutral
// with a pulsing dot rather than a colour of its own.
const TONE_CLASSES: Record<StatusTone, { pill: string; dot: string }> = {
    success: { pill: 'bg-success-soft text-success-soft-foreground', dot: 'bg-success' },
    working: { pill: 'bg-default-soft text-foreground', dot: 'bg-foreground animate-pulse' },
    warning: { pill: 'bg-warning-soft text-warning-soft-foreground', dot: 'bg-warning' },
    danger: { pill: 'bg-danger-soft text-danger-soft-foreground', dot: 'bg-danger' },
    default: { pill: 'bg-default-soft text-foreground', dot: 'bg-muted' }
};

const STATUS_TO_TONE: Record<string, StatusTone> = {
    ready: 'success',
    completed: 'success',
    success: 'success',
    succeeded: 'success',
    active: 'success',
    published: 'success',
    healthy: 'success',
    online: 'success',
    accepted: 'success',
    connected: 'success',

    processing: 'working',
    running: 'working',
    rendering: 'working',
    analyzing: 'working',
    preparing: 'working',
    uploading: 'working',
    updating: 'working',

    warning: 'warning',
    pending: 'warning',
    'waiting-for-process': 'warning',
    draft: 'warning',
    expiring: 'warning',

    failed: 'danger',
    error: 'danger',
    danger: 'danger',
    critical: 'danger',
    rejected: 'danger',
    revoked: 'danger',
    disconnected: 'danger'
};

const resolveStatusTone = (status: string): StatusTone => (
    STATUS_TO_TONE[status.toLowerCase()] ?? 'default'
);

// API statuses arrive as slugs ('waiting-for-process'); the badge reads them as words.
const formatStatusLabel = (status: string): string => {
    const words = status.replace(/[-_]+/g, ' ').trim();

    return words.charAt(0).toUpperCase() + words.slice(1);
};

interface StatusPillProps {
    status: string;
    className?: string;
}

const StatusPill = ({ status, className }: StatusPillProps) => {
    const resolved = TONE_CLASSES[resolveStatusTone(status)];

    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium',
            resolved.pill,
            className
        )}>
            <span className={cn('size-1.5 shrink-0 rounded-full', resolved.dot)} aria-hidden='true' />
            {formatStatusLabel(status)}
        </span>
    );
};

export default StatusPill;
