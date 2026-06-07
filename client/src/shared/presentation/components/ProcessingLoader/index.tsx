import { Loader, Row, Stack, Text } from '@voltstack/bravais';
import './ProcessingLoader.css';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';

interface ProcessingLoaderProps {
    message?: string;
    completionRate?: number;
    className?: string;
    isVisible: boolean;
    showProgress?: boolean;
};

const ProcessingLoader = ({
    message = 'Processing...',
    completionRate = 0,
    isVisible = true,
    className = '',
    showProgress = false
}: ProcessingLoaderProps) => {
    const prefersReducedMotion = usePrefersReducedMotion();

    if (!isVisible) return null;

    const progressPercentage = Math.min(completionRate * 100, 100);
    const statusMessage = showProgress && completionRate > 0
        ? `${message} ${Math.round(progressPercentage)}% complete.`
        : message;

    return (
        <Row gap='075' className={`processing-loader-container ${className}`} role='status' aria-live='polite' aria-atomic='true'>
            <Loader scale={0.6} isFixed={false} className='f-shrink-0' reducedMotionLabel={statusMessage} />
            <Stack gap='035' flex='1'>
                <Text as='p' tone='secondary' className='processing-loader-text overflow-hidden' title={message}>{message}</Text>
                {showProgress && completionRate > 0 && (
                    <div className='w-max overflow-hidden processing-loader-progress-bar' role='progressbar' aria-label='Processing progress' aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercentage)}>
                        <div className='processing-loader-progress-fill h-max' style={{ width: `${progressPercentage}%`, transition: prefersReducedMotion ? 'none' : undefined }} />
                    </div>
                )}
            </Stack>
        </Row>
    );
};

export default ProcessingLoader;
