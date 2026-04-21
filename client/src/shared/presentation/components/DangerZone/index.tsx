import Button from '@/shared/presentation/components/Button';
import type { ReactNode } from 'react';

interface DangerZoneProps{
    title: string;
    description: string;
    actionLabel: string;
    actionIcon?: ReactNode;
    onAction: () => void;
};

const DangerZone = ({
    title,
    description,
    actionIcon,
    actionLabel,
    onAction
}: DangerZoneProps) => {
    return (
        <div className='volt-container zone-danger p-1' role='region' aria-label={title}>
            <div className='volt-container d-flex items-center content-between gap-1'>
                <div className='volt-container d-flex column gap-025'>
                    <h2 className='volt-title font-size-2 font-weight-6'>
                        {title}
                    </h2>
                    <p className='volt-text color-muted font-size-1'>
                        {description}
                    </p>
                </div>
                <Button
                    intent='danger'
                    variant='outline'
                    size='sm'
                    leftIcon={actionIcon}
                    onClick={onAction}
                >
                    {actionLabel}
                </Button>
            </div>
        </div>
    );
};

export default DangerZone;
