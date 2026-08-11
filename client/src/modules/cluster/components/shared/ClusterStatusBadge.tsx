import { cn } from '@heroui/react';
import type { ReactNode } from 'react';

export type ClusterBadgeTone =
    | 'success'
    | 'warning'
    | 'danger'
    | 'neutral'
    | 'inactive'
    | 'active'
    | 'brand'
    | 'primary';

interface ClusterStatusBadgeProps {
    tone: ClusterBadgeTone;
    children: ReactNode;
};

const ClusterStatusBadge = ({ tone, children }: ClusterStatusBadgeProps) => (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium uppercase', {
        success: 'text-success',
        warning: 'text-warning',
        danger: 'text-danger',
        neutral: 'text-muted',
        inactive: 'text-muted',
        active: 'text-foreground',
        brand: 'text-foreground',
        primary: 'text-foreground'
    }[tone])}>
        {children}
    </span>
);

export default ClusterStatusBadge;
