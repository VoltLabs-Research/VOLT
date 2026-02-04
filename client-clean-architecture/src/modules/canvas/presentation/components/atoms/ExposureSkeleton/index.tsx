import React from 'react';
import { motion } from 'framer-motion';
import Container from '@/shared/presentation/components/Container';
import '@/modules/canvas/presentation/components/atoms/ExposureSkeleton/ExposureSkeleton.css';

interface ExposureSkeletonProps {
    count?: number;
    staggerDelay?: number;
    compact?: boolean;
}

const ExposureSkeletonItem: React.FC<{ index: number; staggerDelay: number; compact: boolean }> = ({
    index,
    staggerDelay,
    compact
}) => (
    <motion.div
        className={`exposure-skeleton-item d-flex items-center gap-075 ${compact ? 'compact' : ''} p-05`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
            delay: index * staggerDelay,
            duration: 0.3,
            ease: [0.16, 1, 0.3, 1]
        }}
    >
        <div className="exposure-skeleton-icon shimmer" />
        <Container className="exposure-skeleton-content flex-1">
            <div className="exposure-skeleton-title shimmer" />
            {!compact && <div className="exposure-skeleton-subtitle shimmer w-50" />}
        </Container>
    </motion.div>
);

const ExposureSkeleton: React.FC<ExposureSkeletonProps> = ({
    count = 3,
    staggerDelay = 0.08,
    compact = false
}) => {
    return (
        <Container className="exposure-skeleton-container d-flex column gap-05">
            {Array.from({ length: count }).map((_, index) => (
                <ExposureSkeletonItem
                    key={index}
                    index={index}
                    staggerDelay={staggerDelay}
                    compact={compact}
                />
            ))}
        </Container>
    );
};

export { ExposureSkeleton };
export default ExposureSkeleton;
