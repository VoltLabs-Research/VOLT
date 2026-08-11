

export type StatusVariant =
    | 'active' | 'inactive' | 'danger' | 'neutral'
    | 'success' | 'warning' | 'brand' | 'primary';

const STATUS_VARIANTS: Record<string, StatusVariant> = {
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

export const resolveStatusVariant = (status: string): StatusVariant =>
    STATUS_VARIANTS[status.toLowerCase()] ?? 'neutral';
