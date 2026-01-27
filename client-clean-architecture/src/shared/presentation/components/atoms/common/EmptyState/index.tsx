import React from 'react';
import Container from '@/shared/presentation/components/primitives/Container';
import Button from '@/shared/presentation/components/primitives/Button';
import Title from '@/shared/presentation/components/primitives/Title';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import '@/shared/presentation/components/atoms/common/EmptyState/EmptyState.css';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: React.ReactNode;
    buttonText?: string;
    buttonOnClick?: () => void;
    className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon,
    buttonText,
    buttonOnClick,
    className
}: EmptyStateProps) => {
    return (
        <Container className={`d-flex items-center content-center w-max h-max p-2 sm:p-1-5 empty-state-container ${className || ''}`}>
            <Container className='text-center d-flex column gap-1 items-center empty-state-content color-primary'>
                {icon && (
                    <Container className='d-flex content-center items-center empty-state-icon'>
                        {icon}
                    </Container>
                )}
                <Title className='font-size-4 empty-state-title font-weight-6 color-primary'>{title}</Title>
                <Paragraph className='empty-state-description font-size-3 color-primary line-height-5'>{description}</Paragraph>
                {buttonText && buttonOnClick && (
                    <Button
                        premium
                        shape="pill"
                        onClick={buttonOnClick}
                    >
                        {buttonText}
                    </Button>
                )}
            </Container>
        </Container>
    );
};

export default EmptyState;
