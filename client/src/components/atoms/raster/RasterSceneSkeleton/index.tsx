import React from 'react';
import { Skeleton } from '@mui/material';

const RasterSceneSkeleton: React.FC = () => {
    return (
        <figure className='raster-scene-container' style={{ flex: 1, minWidth: 0 }}>
        <div className='raster-scene-main'>
                <Skeleton
                    variant='rectangular'
                    animation='wave'
                    width='100%'
                    // Match <img.raster-scene> height for consistent responsive layout via CSS var
                    height={'var(--raster-scene-height)'}
                    sx={{
                        borderRadius: '0.75rem',
                        bgcolor: 'rgba(255, 255, 255, 0.06)'
                    }}
                />
            </div>

            <div className='raster-skel raster-skel-select'>
                <Skeleton
                    variant='rounded'
                    animation='wave'
                    height={40}
                    sx={{
                        borderRadius: '0.75rem',
                        bgcolor: 'rgba(255, 255, 255, 0.10)'
                    }}
                />
            </div>

            <div className='raster-skel raster-skel-frame'>
                <Skeleton
                    variant='rounded'
                    animation='wave'
                    width={'min(22vw, 44vw)'}
                    height={'clamp(30px, 5vh, 44px)'}
                    sx={{
                        borderRadius: '9999px',
                        bgcolor: 'rgba(255, 255, 255, 0.10)'
                    }}
                />
            </div>

            <div className='raster-skel raster-skel-playback'>
                <Skeleton
                    variant='rounded'
                    animation='wave'
            width={'min(35vw, 60vw)'}
            height={'clamp(32px, 6vh, 42px)'}
                    sx={{
                        borderRadius: '9999px',
                        bgcolor: 'rgba(255, 255, 255, 0.12)'
                    }}
                />
            </div>

        <div className='raster-skel raster-skel-rail' style={{ width: 'min(132px, 24vw)' }}>
                {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton 
                        key={`rail-skel-${i}`}
                        variant='rounded'
                        animation='wave'
            height={'clamp(68px, 12vh, 84px)'}
            width={'100%'}
                        sx={{
                            borderRadius: '0.75rem',
                            bgcolor: 'rgba(255, 255, 255, 0.08)'
                        }}
                    />
                ))}
            </div>
        </figure>
    );
};

export default RasterSceneSkeleton;