import React from 'react';
import { Skeleton } from '@mui/material';

const ThumbnailSkeleton: React.FC = () => {
    return(
        <div className='raster-thumbnail-container' style={{ position: 'relative' }}>
            <Skeleton
                variant='rectangular'
                animation='wave'
                width={280}
                height={160}
                sx={{
                    borderRadius: '0.75rem',
                    bgcolor: 'rgba(255, 255, 255, 0.06)'
                }}
            />

            <Skeleton
                variant='rounded'
                animation='wave'
                width={58}
                height={26}
                sx={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    borderRadius: '9999px',
                    bgcolor: 'rgba(255, 255, 255, 0.10)'
                }}
            />
        </div>
    );
};

export default ThumbnailSkeleton;
