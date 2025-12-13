import React from 'react';
import { Skeleton } from '@mui/material';

const ThumbnailItemSkeleton: React.FC = () => {
    return(
        <Skeleton
            variant='rounded'
            animation='wave'
            width='100%'
            height='100%'
            className='raster-thumbnail'
            sx={{
                borderRadius: '0.5rem',
                bgcolor: 'rgba(255, 255, 255, 0.06)',
                aspectRatio: '1'
            }}
        />
    );
};

export default ThumbnailItemSkeleton;
