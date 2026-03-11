import './DashboardCard.css';
import Container from '@/shared/presentation/components/Container';
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
        <Container className={classNames.join(' ')} {...props}>
            {children}
        </Container>
    );
};

export default DashboardCard;
