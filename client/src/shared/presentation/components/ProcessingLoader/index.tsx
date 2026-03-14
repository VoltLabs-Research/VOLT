import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
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
        <Container className={`d-flex items-center gap-075 processing-loader-container ${className}`} role='status' aria-live='polite' aria-atomic='true'>
            <Loader scale={0.6} isFixed={false} className='f-shrink-0' reducedMotionLabel={statusMessage} />
            <Container className='d-flex column gap-035 flex-1'>
                <Paragraph className='processing-loader-text overflow-hidden color-secondary' title={message}>{message}</Paragraph>
                {showProgress && completionRate > 0 && (
                    <Container
                        className='w-max overflow-hidden processing-loader-progress-bar'
                        role='progressbar'
                        aria-label='Processing progress'
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progressPercentage)}
                    >
                        <Container
                            className='processing-loader-progress-fill h-max'
                            style={{ width: `${progressPercentage}%`, transition: prefersReducedMotion ? 'none' : undefined }}
                        />
                    </Container>
                )}
            </Container>
        </Container>
    );
};

export default ProcessingLoader;
