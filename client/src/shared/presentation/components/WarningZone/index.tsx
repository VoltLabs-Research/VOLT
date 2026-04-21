import type { ReactNode } from 'react';

interface WarningZoneProps {
    icon?: ReactNode;
    message: string;
    className?: string;
};

const WarningZone = ({
    icon,
    message,
    className = ''
}: WarningZoneProps) => {
    return (
        <div className={`volt-container zone-warning d-flex items-center gap-05 font-size-2 ${className}`} role='status' aria-live='polite'>
            {icon && <div className='volt-container d-flex items-center content-center f-shrink-0'>{icon}</div>}
            <div className='volt-container flex-1'>{message}</div>
        </div>
    );
};

export default WarningZone;
