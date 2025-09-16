import React from 'react';
import { Skeleton } from '@mui/material';

const MetricsBarSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
    return (
        <div className='raster-metrics-bar'>
            <div className='raster-metrics-list' style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                {Array.from({ length: count }, (_, i) => (
                    <Skeleton
                        key={`metric-skel-${i}`}
                        variant='rounded'
                        animation='wave'
                        width={120}
                        height={32}
                        sx={{ borderRadius: '9999px', bgcolor: 'rgba(255, 255, 255, 0.08)' }}
                    />  
                ))}
            </div>
        </div>
    );
};

export default MetricsBarSkeleton;