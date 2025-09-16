import React from 'react';
import { Skeleton } from '@mui/material';

const RasterTrajectoryDetailsSkeleton: React.FC = () => {
    return (
        <>
            <Skeleton
                variant='rounded'
                animation='wave'
                width={220}
                height={22}
                sx={{
                    borderRadius: '6px',
                    bgcolor: 'rgba(255, 255, 255, 0.12)'
                }}
            />

            <Skeleton
                variant='rounded'
                animation='wave'
                width={180}
                height={14}
                sx={{
                    borderRadius: '6px',
                    mt: 0.75,
                    bgColor: 'rgba(255, 255, 255, 0.08)'
                }}
            />
        </>
    );
};

export default RasterTrajectoryDetailsSkeleton;