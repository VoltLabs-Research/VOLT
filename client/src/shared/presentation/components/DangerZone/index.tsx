import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import React from 'react';

interface DangerZoneProps{
    title: string;
    description: string;
    actionLabel: string;
    actionIcon?: React.ReactNode;
    onAction: () => void;
};

const DangerZone: React.FC<DangerZoneProps> = ({
    title,
    description,
    actionIcon,
    actionLabel,
    onAction
}) => {
    return (
        <Container className='zone-danger p-1'>
            <Container className='d-flex items-center content-between gap-1'>
                <Container className='d-flex column gap-025'>
                    <Title className='font-size-2 font-weight-6'>
                        {title}
                    </Title>
                    <Paragraph className='color-muted font-size-1'>
                        {description}
                    </Paragraph>
                </Container>
                <Button
                    intent='danger'
                    variant='outline'
                    size='sm'
                    leftIcon={actionIcon}
                    onClick={onAction}
                >
                    {actionLabel}
                </Button>
            </Container>
        </Container>
    );
};

export default DangerZone;
