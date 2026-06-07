import './DashboardCard.css';
import { Box } from '@voltstack/bravais';
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
    const classNames = ['dashboard-card'];

    if (className) {
        classNames.push(className);
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
