import React from 'react';
import Container from '@/components/primitives/Container';
import '@/components/atoms/common/ProcessingLoader/ProcessingLoader.css';
import Paragraph from '@/components/primitives/Paragraph';

interface ProcessingLoaderProps {
    message?: string;
    completionRate?: number;
    className?: string,
    isVisible: boolean;
    showProgress?: boolean;
}

const ProcessingLoader: React.FC<ProcessingLoaderProps> = ({
    message = 'Processing...',
    completionRate = 0,
    isVisible = true,
    className = '',
    showProgress = false
}) => {
    if(!isVisible) return null;

    return (
        <Container className={`d-flex items-center gap-075 processing-loader-container ${className}`}>
            <Container className="processing-loader-spinner f-shrink-0" />
            <Container className="d-flex column gap-035 flex-1 column">
                <Paragraph className="processing-loader-text overflow-hidden color-secondary">{message}</Paragraph>
                {showProgress && completionRate > 0 && (
                    <Container className="w-max overflow-hidden processing-loader-progress-bar">
                        <Container
                            className="processing-loader-progress-fill h-max"
                            style={{ width: `${Math.min(completionRate * 100, 100)}%` }}
                        />
                    </Container>
                )}
            </Container>
        </Container>
    );
};

export default ProcessingLoader;
