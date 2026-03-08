import Container from '@/shared/presentation/components/Container';
import React from 'react';

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
        <Container className={`zone-warning d-flex items-center gap-05 font-size-2 ${className}`}>
            {icon && <Container className='d-flex items-center content-center f-shrink-0'>{icon}</Container>}
            <Container className='flex-1'>{message}</Container>
        </Container>
    );
};

export default WarningZone;
