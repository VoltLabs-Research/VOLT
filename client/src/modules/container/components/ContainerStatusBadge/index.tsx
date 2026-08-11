import { cn } from '@heroui/react';
import { resolveStatusVariant } from '@/shared/ui/status-vocabulary';

interface ContainerStatusBadgeProps {
    status: string;
};

const ContainerStatusBadge = ({ status }: ContainerStatusBadgeProps) => (
    <span
        className={cn('inline-flex items-center gap-1 rounded-full text-xs font-medium uppercase whitespace-nowrap', {
            active: 'text-foreground',
            brand: 'text-foreground',
            primary: 'text-foreground',
            success: 'text-success',
            warning: 'text-warning',
            danger: 'text-danger',
            inactive: 'text-muted',
            neutral: 'text-muted'
        }[resolveStatusVariant(status)])}
    >
        {status}
    </span>
);

export default ContainerStatusBadge;
