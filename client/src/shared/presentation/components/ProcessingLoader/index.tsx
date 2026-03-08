import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './ProcessingLoader.css';

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
    if (!isVisible) return null;

    return (
        <Container className={`d-flex items-center gap-075 processing-loader-container ${className}`}>
            <Loader scale={0.6} isFixed={false} className='f-shrink-0' />
            <Container className='d-flex column gap-035 flex-1'>
                <Paragraph className='processing-loader-text overflow-hidden color-secondary'>{message}</Paragraph>
                {showProgress && completionRate > 0 && (
                    <Container className='w-max overflow-hidden processing-loader-progress-bar'>
                        <Container
                            className='processing-loader-progress-fill h-max'
                            style={{ width: `${Math.min(completionRate * 100, 100)}%` }}
                        />
                    </Container>
                )}
            </Container>
        </Container>
    );
};

export default ProcessingLoader;
