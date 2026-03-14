import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import './EmptyState.css';
import { useId } from 'react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: ReactNode;
    buttonText?: string;
    buttonOnClick?: () => void;
    buttonIsLoading?: boolean;
    className?: string;
    headingLevel?: 'h1' | 'h2' | 'h3';
    announce?: boolean;
};

const EmptyState = ({
    title,
    description,
    icon,
    buttonText,
    buttonOnClick,
    buttonIsLoading = false,
    className,
    headingLevel = 'h2',
    announce = false
}: EmptyStateProps) => {
    const headingId = useId();

    return (
        <section aria-labelledby={headingId} className={`d-flex items-center content-center w-max h-max empty-state-container ${className || ''}`}>
            <Container className='text-center d-flex column gap-1-5 items-center empty-state-content'>
                {announce && (
                    <span className='empty-state-live-region' aria-live='polite' aria-atomic='true'>
                        {title}. {description}
                    </span>
                )}
                {icon && (
                    <Container className='d-flex content-center items-center empty-state-icon color-muted'>
                        {icon}
                    </Container>
                )}

                <Container className='d-flex column gap-05 text-center'>
                    <Title as={headingLevel} id={headingId} className='font-size-3 font-weight-5 color-primary'>
                        {title}
                    </Title>
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
        </section>
    );
};

export default EmptyState;
