import { cn } from '@heroui/react';

export type StatusTone = 'success' | 'warning' | 'danger' | 'accent' | 'muted';

const TONE_CLASSES: Record<StatusTone, { pill: string; dot: string }> = {
    success: { pill: 'bg-success/10 text-success', dot: 'bg-success' },
    warning: { pill: 'bg-warning/10 text-warning', dot: 'bg-warning' },
    danger: { pill: 'bg-danger/10 text-danger', dot: 'bg-danger' },
    accent: { pill: 'bg-accent/10 text-accent', dot: 'bg-accent' },
    muted: { pill: 'bg-surface-hover text-muted', dot: 'bg-muted' }
};

const STATUS_TO_TONE: Record<string, StatusTone> = {
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
    preparing: 'warning',

    running: 'accent',
    brand: 'accent',

    failed: 'danger',
    error: 'danger',
    danger: 'danger',
    critical: 'danger',
    rejected: 'danger',

    inactive: 'muted',
    draft: 'muted',
    disabled: 'muted',
    offline: 'muted',
    disconnected: 'muted'
};

export const resolveStatusTone = (status: string): StatusTone => (
    STATUS_TO_TONE[status.toLowerCase()] ?? 'muted'
);

interface StatusPillProps {
    status: string;
    tone?: StatusTone;
    className?: string;
}

const StatusPill = ({ status, tone, className }: StatusPillProps) => {
    const resolved = TONE_CLASSES[tone ?? resolveStatusTone(status)];

    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
            resolved.pill,
            className
        )}>
            <span className={cn('size-1.5 shrink-0 rounded-full', resolved.dot)} aria-hidden='true' />
            {status}
        </span>
    );
};

export default StatusPill;
