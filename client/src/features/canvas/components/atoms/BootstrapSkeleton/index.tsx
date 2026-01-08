import React from 'react';
import { Skeleton } from '@mui/material';
import Container from '@/components/primitives/Container';
import ExposureSkeleton from '@/features/canvas/components/atoms/ExposureSkeleton';

interface BootstrapSkeletonProps {
    count?: number;
}

const BootstrapSkeleton: React.FC<BootstrapSkeletonProps> = ({ count = 3 }) => {
    return (
        <>
            {Array.from({ length: Math.min(3, Math.max(1, count)) }).map((_, i) => (
                <Container key={`bootstrap-skel-${i}`} className='analysis-section overflow-hidden'>
                    <Container className='analysis-section-header d-flex column gap-05 p-1'>
                        <Container className='d-flex items-center gap-05'>
                            <Skeleton variant="circular" width={16} height={16} />
                            <Skeleton variant="text" width={160} height={24} />
                            <Skeleton variant="text" width={90} height={24} />
                        </Container>
                        <Skeleton variant="text" width={240} height={18} />
                    </Container>
                    <Container className='analysis-section-content'>
                        <ExposureSkeleton count={2} compact />
                    </Container>
                </Container>
            ))}
        </>
    );
};

export default BootstrapSkeleton;
