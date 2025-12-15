import React from 'react';
import Container from '@/components/primitives/Container';
import './EmptyState.css';

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

    return(
        <Container className={`d-flex items-center content-center w-max h-max p-2 sm:p-1-5 empty-state-container ${className || ''}`}>
            <Container className='text-center d-flex column gap-1 items-center empty-state-content'>
                {icon && (
                    <Container className='d-flex content-center items-center empty-state-icon'>
                        {icon}
                    </Container>
                )}
                <h2 className='empty-state-title'>{title}</h2>
                <p className='empty-state-description'>{description}</p>
                {buttonText && buttonOnClick && (
                    <button
                        className='empty-state-button'
                        onClick={buttonOnClick}
                    >
                        {buttonText}
                    </button>
                )}
            </Container>
        </Container>
    );
};

export default EmptyState;
