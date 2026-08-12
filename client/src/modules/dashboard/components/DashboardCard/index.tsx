import { cn } from '@heroui/react';
import type { HTMLAttributes, ReactNode } from 'react';

interface DashboardCardProps extends HTMLAttributes<HTMLDivElement> {
    children?: ReactNode;
    isRelative?: boolean;
    overflowHidden?: boolean;
}

const DashboardCard = ({
    children,
    className = '',
    isRelative = false,
    overflowHidden = false,
    ...props
}: DashboardCardProps) => {
    return (
        <div
            className={cn(
                'border border-border rounded-xl',
                isRelative && 'relative',
                overflowHidden && 'overflow-hidden',
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};

export default DashboardCard;
