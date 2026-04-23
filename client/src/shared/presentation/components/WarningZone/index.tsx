import { Row, Surface } from '@/shared/presentation/primitives';
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
        <Surface variant='warning' display='flex' align='center' gap='05' className={`font-size-2 ${className}`} role='status' aria-live='polite'>
            {icon && <Row justify='center' shrink='0'>{icon}</Row>}
            <div className='flex-1'>{message}</div>
        </Surface>
    );
};

export default WarningZone;
