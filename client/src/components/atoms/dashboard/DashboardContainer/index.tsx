import Container from '@/components/primitives/Container';
import '@/components/atoms/dashboard/DashboardContainer/DashboardContainer.css';

import type { ReactNode } from 'react';

type DashboardContainerProps = {
    children: ReactNode;
    className?: string;
};

const DashboardContainer = ({ children, className = '' }: DashboardContainerProps) => {

    return (
        <Container className={'w-max flex-1 y-auto dashboard-container '.concat(className + '-wrapper')}>
            <Container className={className}>
                {children}
            </Container>
        </Container>
    );
};

export default DashboardContainer;
