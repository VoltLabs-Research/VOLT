import Button from '@/shared/presentation/primitives/Button';
import Heading from '@/shared/presentation/primitives/Heading';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import './EmptyState.css';
import { forwardRef, useId } from 'react';
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

const EmptyState = forwardRef<HTMLElement, EmptyStateProps>(({
    title,
    description,
    icon,
    buttonText,
    buttonOnClick,
    buttonIsLoading = false,
    className,
    headingLevel = 'h2',
    announce = false
}, ref) => {
    const headingId = useId();
    const level = Number(headingLevel.slice(1)) as 1 | 2 | 3;

    return (
        <section ref={ref} aria-labelledby={headingId} className={`d-flex items-center content-center w-max h-max empty-state-container ${className || ''}`}>
            <Stack align='center' gap='1-5' textAlign='center' className='empty-state-content'>
                {announce && (
                    <span className='empty-state-live-region' aria-live='polite' aria-atomic='true'>
                        {title}. {description}
                    </span>
                )}
                {icon && (
                    <Stack align='center' justify='center' className='empty-state-icon color-muted'>
                        {icon}
                    </Stack>
                )}

                <Stack gap='05' textAlign='center'>
                    <Heading level={level} id={headingId}>
                        {title}
                    </Heading>
                    <Text size='md' tone='secondary' lineHeight='5'>{description}</Text>
                </Stack>

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
            </Stack>
        </section>
    );
});

EmptyState.displayName = 'EmptyState';

export default EmptyState;
