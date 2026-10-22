import { cn } from '@heroui/react';
import type { ReactNode } from 'react';

export type ClusterBadgeTone =
    | 'success'
    | 'warning'
    | 'danger'
    | 'neutral'
    | 'inactive'
    | 'brand';

interface ClusterStatusBadgeProps {
    tone: ClusterBadgeTone;
    children: ReactNode;
};

// The status badge of the rest of the app (StatusPill): a soft fill with a dot of the tone.
const TONE_CLASSES: Record<ClusterBadgeTone, { badge: string; dot: string }> = {
    success: { badge: 'bg-success-soft text-success-soft-foreground', dot: 'bg-success' },
    warning: { badge: 'bg-warning-soft text-warning-soft-foreground', dot: 'bg-warning' },
    danger: { badge: 'bg-danger-soft text-danger-soft-foreground', dot: 'bg-danger' },
    neutral: { badge: 'bg-default text-muted', dot: 'bg-muted' },
    inactive: { badge: 'bg-default text-muted', dot: 'bg-muted' },
    brand: { badge: 'bg-default text-foreground', dot: 'bg-foreground' }
};

const ClusterStatusBadge = ({ tone, children }: ClusterStatusBadgeProps) => (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium', TONE_CLASSES[tone].badge)}>
        <span className={cn('size-1.5 shrink-0 rounded-full', TONE_CLASSES[tone].dot)} aria-hidden='true' />
        {children}
    </span>
);

export default ClusterStatusBadge;
