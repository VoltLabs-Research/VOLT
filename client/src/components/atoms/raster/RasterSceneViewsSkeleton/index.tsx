import React from 'react';
import { Skeleton } from '@mui/material';

const RasterSceneViewsSkeleton: React.FC = () => {
    return (
        <div className='raster-scene-header-views-container'>
            <i className='raster-scene-header-views-icon-container'>
                <Skeleton
                    variant='circular'
                    width={18}
                    height={18}
                    sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.12)',
                        borderRadius: '9999px'
                    }}
                />
            </i>

            <Skeleton
                variant='rounded'
                width={80}
                height={16}
                sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.12)',
                    borderRadius: '9999px'
                }}
            />
        </div>
    );
};

export default RasterSceneViewsSkeleton;