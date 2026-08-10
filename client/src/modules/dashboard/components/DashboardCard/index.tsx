import { cn } from '@heroui/react';
import type { HTMLAttributes, ReactNode } from 'react';

interface DashboardCardProps extends HTMLAttributes<HTMLDivElement> {
    children?: ReactNode;
    isRelative?: boolean;
    overflowHidden?: boolean;
}

/**
 * `.dashboard-card` was `1px solid var(--color-border-soft)` at
 * `var(--radius-xl)`. That radius is 20px on bravais's scale, a full step away
 * from HeroUI's same-named `rounded-xl` (12px) — hence the arbitrary value
 * (spec §3b).
 */
const CARD = 'border border-border rounded-[1.25rem]';

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
                CARD,
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
