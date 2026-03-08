import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import './EmptyState.css';
import React from 'react';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: React.ReactNode;
    buttonText?: string;
    buttonOnClick?: () => void;
    buttonIsLoading?: boolean;
    className?: string;
};

const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon,
    buttonText,
    buttonOnClick,
    buttonIsLoading = false,
    className
}: EmptyStateProps) => {
    return (
        <Container className={`d-flex items-center content-center w-max h-max empty-state-container ${className || ''}`}>
            <Container className='text-center d-flex column gap-1-5 items-center empty-state-content'>
                {icon && (
                    <Container className='d-flex content-center items-center empty-state-icon color-muted'>
                        {icon}
                    </Container>
                )}

                <Container className='d-flex column gap-05 text-center'>
                    <span className='font-size-3 font-weight-5 color-primary'>{title}</span>
                    <span className='font-size-2 color-secondary line-height-5'>{description}</span>
                </Container>

                {buttonText && buttonOnClick && (
                    <Button
                        variant='solid'
                        intent='brand'
                        size='sm'
                        onClick={buttonOnClick}
                        isLoading={buttonIsLoading}
                        className='mt-05'
                    >
                        {buttonText}
                    </Button>
                )}
            </Container>
        </Container>
    );
};

export default EmptyState;
