import './DashboardCard.css';
import { Box } from '@/shared/presentation/primitives';
import type { HTMLAttributes, ReactNode } from 'react';

interface DashboardCardProps extends HTMLAttributes<HTMLDivElement> {
    children?: ReactNode;
    isClickable?: boolean;
    isRelative?: boolean;
    overflowHidden?: boolean;
};

const DashboardCard = ({
    children,
    className = '',
    isClickable = false,
    isRelative = false,
    overflowHidden = false,
    ...props
}: DashboardCardProps) => {
    const classNames = ['dashboard-card'];

    if (className) {
        classNames.push(className);
    }

    if (isClickable) {
        classNames.push('dashboard-card--clickable');
    }

    if (isRelative) {
        classNames.push('dashboard-card--relative');
    }

    if (overflowHidden) {
        classNames.push('dashboard-card--overflow-hidden');
    }

    return (
        <Box className={classNames.join(' ')} {...props}>
            {children}
        </Box>
    );
};

export default DashboardCard;
