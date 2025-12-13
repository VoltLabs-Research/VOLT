import React from 'react';
import { Skeleton } from '@mui/material';

interface ModelRailSkeletonProps {
    width?: string | number;
    height?: string | number;
    isSelected?: boolean;
}

const ModelRailSkeleton: React.FC<ModelRailSkeletonProps> = ({
    width = '100%',
    height = 84,
    isSelected = false
}) => {
    return(
        <Skeleton
            variant='rounded'
            animation='wave'
            width={width}
            height={height}
            sx={{
                borderRadius: '0.75rem',
                bgcolor: isSelected
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(255, 255, 255, 0.08)',
                border: isSelected ? '1px solid var(--accent)' : 'none',
                flexShrink: 0
            }}
        />
    );
};

export default ModelRailSkeleton;
