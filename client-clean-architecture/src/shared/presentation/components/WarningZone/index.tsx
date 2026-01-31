import React from 'react';
import Container from '@/shared/presentation/components/Container';
import './WarningZone.css';

interface WarningZoneProps {
    icon?: React.ReactNode;
    message: string;
    className?: string;
};

const WarningZone: React.FC<WarningZoneProps> = ({
    icon,
    message,
    className = ''
}) => {
    return (
        <Container className={`warning-zone d-flex items-center gap-05 ${className}`}>
            {icon && <Container className='d-flex items-center content-center f-shrink-0'>{icon}</Container>}
            <Container className='flex-1'>{message}</Container>
        </Container>
    );
};

export default WarningZone;
